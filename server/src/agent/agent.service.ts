import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, tool, ModelMessage } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { Subject, ReplaySubject, Observable } from 'rxjs';
import { z } from 'zod';

import { JobsService } from '../jobs/jobs.service.js';
import { SandboxService } from '../sandbox/sandbox.service.js';
import { GithubService } from '../github/github.service.js';
import { McpService } from '../mcp/mcp.service.js';
import { VercelService } from '../vercel/vercel.service.js';
import { AGENT_SYSTEM_PROMPT } from './prompts/agent-system.prompt.js';
import {
    createCloneRepoTool,
    createDetectFrameworkTool,
    createAnalyzeRepoTool,
    createSetupLingoTool,
    createInstallTranslateTool,
    createCommitPushTool,
    createTriggerPreviewTool,
} from './tools/index.js';
import type { EmitFn } from '../common/types/index.js';
import type { SseEvent } from '../common/types/events.types.js';

/** Orchestrates the 7-tool agent pipeline; manages per-job SSE streams via RxJS Subjects. */
@Injectable()
export class AgentService {
    private readonly logger = new Logger(AgentService.name);

    // One Subject per active job; removed on completion/error
    private readonly streams = new Map<string, ReplaySubject<SseEvent>>();

    // Track abort controllers to allow manual cancellations
    private readonly abortControllers = new Map<string, AbortController>();

    private readonly groqApiKey: string;
    private readonly lingoApiKey: string;

    constructor(
        private readonly jobs: JobsService,
        private readonly sandbox: SandboxService,
        private readonly github: GithubService,
        private readonly mcp: McpService,
        private readonly vercel: VercelService,
        private readonly config: ConfigService,
    ) {
        this.groqApiKey = this.config.getOrThrow<string>('GROQ_API_KEY');
        this.lingoApiKey = this.config.getOrThrow<string>('LINGO_API_KEY');
    }

    /** Creates a job record, fires off the pipeline async (non-blocking), and returns the job ID. */
    async startJob(repoUrl: string, locales: string[], githubToken: string): Promise<string> {
        const job = await this.jobs.create(repoUrl, locales);
        const subject = new ReplaySubject<SseEvent>();
        this.streams.set(job.id, subject);

        const abortController = new AbortController();
        this.abortControllers.set(job.id, abortController);

        // Fire and forget — SSE events flow through the subject
        this.runPipeline(job.id, repoUrl, locales, githubToken, subject).catch((err) => {
            this.logger.error(`Pipeline error for job ${job.id}: ${String(err)}`);
        });

        return job.id;
    }

    /** Fetches the current state of a job */
    async getJob(jobId: string) {
        return this.jobs.findOneOrThrow(jobId);
    }

    /** Returns the SSE observable for a job. The frontend subscribes to this. */
    getStream(jobId: string): Observable<SseEvent> {
        const subject = this.streams.get(jobId);
        if (!subject) {
            throw new Error(`No active stream for job ${jobId}. Job may have already completed.`);
        }
        return subject.asObservable();
    }

    /** Manually aborts a running job */
    async cancelJob(jobId: string): Promise<void> {
        const ac = this.abortControllers.get(jobId);
        if (ac) {
            ac.abort(new Error('Job manually cancelled by user'));
            this.abortControllers.delete(jobId);
            await this.jobs.setError(jobId, 'Cancelled by user');
        }
    }

    // ---------------------------------------------------------------------------
    // Private pipeline runner
    // ---------------------------------------------------------------------------

    private async runPipeline(
        jobId: string,
        repoUrl: string,
        locales: string[],
        githubToken: string,
        subject: ReplaySubject<SseEvent>,
    ): Promise<void> {
        const activeLogs: import('../common/types/agent.types.js').LogEntry[] = [];
        const emit: EmitFn = (entry) => {
            activeLogs.push(entry);
            subject.next({ type: 'log', data: entry });
        };

        try {
            await this.jobs.updateStatus(jobId, 'running');

            const modelName = this.config.get<string>('DEFAULT_AI_MODEL') || 'llama-3.3-70b-versatile';
            const groq = createGroq({ apiKey: this.groqApiKey });

            // ---------------------------------------------------------------------------
            // Build schema-only tools (no execute fn) for LLM argument extraction.
            // We manually execute tools OUTSIDE the generateText call to avoid
            // LLM-API timeout issues on long-running operations like git clone.
            // ---------------------------------------------------------------------------

            const fullTools = {
                clone_repo: createCloneRepoTool(this.sandbox, emit),
                detect_framework: createDetectFrameworkTool(this.sandbox, emit),
                analyze_repo: createAnalyzeRepoTool(this.sandbox, emit),
                setup_lingo: createSetupLingoTool(this.sandbox, this.mcp, emit),
                install_and_translate: createInstallTranslateTool(this.sandbox, this.lingoApiKey, emit),
                commit_and_push: createCommitPushTool(this.sandbox, this.github, emit),
                trigger_preview: createTriggerPreviewTool(this.vercel, emit),
            };

            // Schema-only version: LLM sees the tool and picks args, but does NOT execute it
            const schemaOnlyTools = Object.fromEntries(
                Object.entries(fullTools).map(([name, t]) => [
                    name,
                    tool({
                        description: (t as any).description,
                        inputSchema: (t as any).inputSchema as z.ZodTypeAny,
                        // NOTE: no `execute` — LLM returns toolCalls, we execute manually
                    }),
                ]),
            );

            const toolSequence = [
                'clone_repo',
                'detect_framework',
                'analyze_repo',
                'setup_lingo',
                'install_and_translate',
                'commit_and_push',
                'trigger_preview',
            ] as const;

            const userMessage =
                `Repository: ${repoUrl}\n` +
                `Target locales: ${locales.join(', ')}\n` +
                `GitHub token: ${githubToken}\n\n` +
                `Execute exactly ONE tool now: 'clone_repo'. Wait for the result before proceeding.`;

            let messages: ModelMessage[] = [{ role: 'user', content: userMessage }];
            let prUrl: string | undefined;
            let previewUrl: string | undefined;
            let currentToolIndex = 0;
            const maxIterations = 20;
            const maxRetries = 3;
            let retriesForCurrentTool = 0;

            this.logger.log(`[Job ${jobId}] Starting pipeline with model: ${modelName}`);

            for (let i = 0; i < maxIterations; i++) {
                if (currentToolIndex >= toolSequence.length) break;

                const currentExpectedTool = toolSequence[currentToolIndex];

                // Expose only ONE schema to the LLM to force strict sequential execution
                const currentSchema = { [currentExpectedTool]: schemaOnlyTools[currentExpectedTool] };

                this.logger.log(`[Job ${jobId}] Iteration ${i}: Asking LLM to call '${currentExpectedTool}'`);

                // ── Step A: Ask LLM ONLY to generate the tool call (fast — no I/O here) ──
                let stepResult: Awaited<ReturnType<typeof generateText>>;
                try {
                    stepResult = await generateText({
                        model: groq(modelName),
                        system: AGENT_SYSTEM_PROMPT,
                        messages,
                        tools: currentSchema as any,
                        toolChoice: 'required', // Force the model to call a tool — no text-only responses
                        maxOutputTokens: 1024,
                        abortSignal: this.abortControllers.get(jobId)?.signal,
                    });
                } catch (llmErr: any) {
                    const errMsg = llmErr?.message || String(llmErr);
                    // "tool call validation failed" = LLM hallucinated a wrong tool name.
                    // Treat like a missed tool call — retry rather than kill the pipeline.
                    const isValidationError =
                        errMsg.includes('tool call validation failed') ||
                        errMsg.includes('was not in request.tools');
                    if (isValidationError) {
                        retriesForCurrentTool++;
                        this.logger.warn(`[Job ${jobId}] LLM called wrong tool name (retry ${retriesForCurrentTool}/${maxRetries}): ${errMsg}`);
                        if (retriesForCurrentTool >= maxRetries) {
                            throw new Error(`Pipeline stalled at '${currentExpectedTool}' — LLM kept calling a non-existent tool after ${maxRetries} retries.`);
                        }
                        messages.push({
                            role: 'user',
                            content: `You called a tool that does not exist. You MUST call ONLY '${currentExpectedTool}'. No other tool name is valid.`,
                        });
                        await new Promise((r) => setTimeout(r, 1500));
                        continue;
                    }
                    // Hard API errors (rate limit, auth, network) — fail fast
                    this.logger.error(`[Job ${jobId}] LLM API error: ${errMsg}`);
                    throw new Error(`LLM error at step '${currentExpectedTool}': ${errMsg}`);
                }

                if (stepResult.text) {
                    this.logger.debug(`[Job ${jobId}] LLM text (expected tool call): "${stepResult.text.substring(0, 150)}"`);
                }

                this.logger.log(`[Job ${jobId}] toolCalls from LLM: ${stepResult.toolCalls?.length ?? 0}`);

                // ── Step B: Find the intended tool call ──
                const toolCall = stepResult.toolCalls?.find(
                    (tc: any) => tc.toolName === currentExpectedTool,
                );

                if (!toolCall) {
                    retriesForCurrentTool++;
                    this.logger.warn(`[Job ${jobId}] LLM did not call '${currentExpectedTool}'. Retry ${retriesForCurrentTool}/${maxRetries}`);

                    if (retriesForCurrentTool >= maxRetries) {
                        throw new Error(
                            `Pipeline stalled at step '${currentExpectedTool}' after ${maxRetries} retries. ` +
                            `The LLM kept responding with text instead of a tool call. Try again.`,
                        );
                    }

                    // Add LLM's non-tool reply to history, then nudge
                    if (stepResult.response?.messages?.length) {
                        messages.push(...stepResult.response.messages);
                    }
                    messages.push({
                        role: 'user',
                        content: `You MUST call the tool '${currentExpectedTool}' now. Use the tool interface directly — do not write text or JSON.`,
                    });
                    await new Promise((r) => setTimeout(r, 1500));
                    continue;
                }

                // LLM generated a valid tool call — reset retry counter
                retriesForCurrentTool = 0;

                const toolArgs = (toolCall as any).input ?? (toolCall as any).args ?? {};
                this.logger.log(`[Job ${jobId}] Executing '${currentExpectedTool}' with args: ${JSON.stringify(toolArgs)}`);

                // ── Step C: Execute the tool MANUALLY (no SDK timeout concerns) ──
                let toolOutput: any;
                try {
                    toolOutput = await (fullTools as any)[currentExpectedTool].execute(toolArgs, {});
                } catch (toolErr: any) {
                    const errMsg = toolErr?.message || String(toolErr);
                    this.logger.error(`[Job ${jobId}] Tool '${currentExpectedTool}' threw: ${errMsg}`);
                    throw new Error(`Tool '${currentExpectedTool}' failed: ${errMsg}`);
                }

                this.logger.log(`[Job ${jobId}] Tool '${currentExpectedTool}' succeeded: ${JSON.stringify(toolOutput)}`);

                // Capture PR/preview URLs whenever available
                if (toolOutput?.prUrl) prUrl = toolOutput.prUrl;
                if (toolOutput?.previewUrl) previewUrl = toolOutput.previewUrl;

                // Advance the sequence index
                currentToolIndex++;

                // Pipeline done — all tools completed
                if (currentToolIndex >= toolSequence.length) break;

                const nextTool = toolSequence[currentToolIndex];

                // Use plain user messages to pass tool results — avoids SDK ModelMessage schema issues
                // with complex tool-call/tool-result role formats that change across SDK versions.
                messages.push({
                    role: 'user',
                    content:
                        `Tool '${currentExpectedTool}' completed successfully.\n` +
                        `Result: ${JSON.stringify(toolOutput)}\n\n` +
                        `Now call exactly ONE tool: '${nextTool}'.`,
                });
            }

            if (!prUrl) {
                const stalledAt = toolSequence[Math.min(currentToolIndex, toolSequence.length - 1)];
                throw new Error(
                    `Pipeline ended without a PR URL. Last attempted step: '${stalledAt}'. ` +
                    `Completed ${currentToolIndex}/${toolSequence.length} steps.`,
                );
            }

            this.logger.log(`[Job ${jobId}] Pipeline complete! prUrl=${prUrl}, previewUrl=${previewUrl}`);
            await this.jobs.setResult(jobId, prUrl, previewUrl ?? '');
            subject.next({ type: 'complete', data: { prUrl, previewUrl: previewUrl ?? '' } });
            subject.complete();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`[Job ${jobId}] Failed: ${message}`);
            await this.jobs.setError(jobId, message);
            subject.next({ type: 'error', data: { message, step: 'unknown' } });
            subject.complete();
        } finally {
            try {
                await this.jobs.saveLogs(jobId, activeLogs);
            } catch (saveErr) {
                this.logger.error(`[Job ${jobId}] Failed to save logs: ${saveErr}`);
            }
            this.streams.delete(jobId);
            this.abortControllers.delete(jobId);
        }
    }
}
