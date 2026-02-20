import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, stepCountIs } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { Subject, Observable } from 'rxjs';

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
    private readonly streams = new Map<string, Subject<SseEvent>>();

    private readonly googleApiKey: string;
    private readonly lingoApiKey: string;

    constructor(
        private readonly jobs: JobsService,
        private readonly sandbox: SandboxService,
        private readonly github: GithubService,
        private readonly mcp: McpService,
        private readonly vercel: VercelService,
        private readonly config: ConfigService,
    ) {
        this.googleApiKey = this.config.getOrThrow<string>('GOOGLE_GENERATIVE_AI_API_KEY');
        this.lingoApiKey = this.config.getOrThrow<string>('LINGO_API_KEY');
    }

    /** Creates a job record, fires off the pipeline async (non-blocking), and returns the job ID. */
    async startJob(repoUrl: string, locales: string[], githubToken: string): Promise<string> {
        const job = await this.jobs.create(repoUrl, locales);
        const subject = new Subject<SseEvent>();
        this.streams.set(job.id, subject);

        // Fire and forget — SSE events flow through the subject
        this.runPipeline(job.id, repoUrl, locales, githubToken, subject).catch((err) => {
            this.logger.error(`Pipeline error for job ${job.id}: ${String(err)}`);
        });

        return job.id;
    }

    /** Returns the SSE observable for a job. The frontend subscribes to this. */
    getStream(jobId: string): Observable<SseEvent> {
        const subject = this.streams.get(jobId);
        if (!subject) {
            throw new Error(`No active stream for job ${jobId}. Job may have already completed.`);
        }
        return subject.asObservable();
    }

    // ---------------------------------------------------------------------------
    // Private pipeline runner
    // ---------------------------------------------------------------------------

    private async runPipeline(
        jobId: string,
        repoUrl: string,
        locales: string[],
        githubToken: string,
        subject: Subject<SseEvent>,
    ): Promise<void> {
        const emit: EmitFn = (entry) => {
            subject.next({ type: 'log', data: entry });
        };

        try {
            await this.jobs.updateStatus(jobId, 'running');

            const google = createGoogleGenerativeAI({ apiKey: this.googleApiKey });

            const tools = {
                clone_repo: createCloneRepoTool(this.sandbox, emit),
                detect_framework: createDetectFrameworkTool(this.sandbox, emit),
                analyze_repo: createAnalyzeRepoTool(this.sandbox, emit),
                setup_lingo: createSetupLingoTool(this.sandbox, this.mcp, emit),
                install_and_translate: createInstallTranslateTool(this.sandbox, this.lingoApiKey, emit),
                commit_and_push: createCommitPushTool(this.sandbox, this.github, emit),
                trigger_preview: createTriggerPreviewTool(this.vercel, emit),
            };

            const userMessage =
                `Repository: ${repoUrl}\n` +
                `Target locales: ${locales.join(', ')}\n` +
                `GitHub token: ${githubToken}\n\n` +
                `Begin the pipeline now. Execute all 7 tools in order.`;

            // AI SDK v6: stopWhen + stepCountIs replaces maxSteps
            const { steps } = await generateText({
                model: google('gemini-3-flash-preview'),
                system: AGENT_SYSTEM_PROMPT,
                prompt: userMessage,
                tools,
                stopWhen: stepCountIs(15),
            });

            // Extract final results from tool outputs — SDK v6 uses `.output` on TypedToolResult
            let prUrl: string | undefined;
            let previewUrl: string | undefined;

            for (const step of steps) {
                for (const item of step.toolResults ?? []) {
                    // Cast to access typed output from each tool result
                    const tr = item as { toolName: string; output: Record<string, unknown> };
                    if (tr.toolName === 'commit_and_push') prUrl = tr.output.prUrl as string;
                    if (tr.toolName === 'trigger_preview') previewUrl = tr.output.previewUrl as string;
                }
            }

            if (!prUrl) throw new Error('Pipeline completed but no PR URL was returned.');

            await this.jobs.setResult(jobId, prUrl, previewUrl ?? '');
            subject.next({ type: 'complete', data: { prUrl, previewUrl: previewUrl ?? '' } });
            subject.complete();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Job ${jobId} failed: ${message}`);
            await this.jobs.setError(jobId, message);
            subject.next({ type: 'error', data: { message, step: 'unknown' } });
            subject.complete();
        } finally {
            this.streams.delete(jobId);
        }
    }
}
