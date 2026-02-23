import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sandbox } from 'e2b';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Manages E2B cloud sandbox instances for isolated code execution.
 * Untrusted repository operations happen inside these isolated sandboxes.
 */
@Injectable()
export class SandboxService implements OnModuleDestroy {
  private readonly logger = new Logger(SandboxService.name);
  private readonly sandboxes = new Map<string, Sandbox>();
  private readonly apiKey: string;

  // Conservative timeout for hackathon: 10 minutes per sandbox
  private readonly SANDBOX_TIMEOUT_MS = 10 * 60 * 1000;

  constructor(config: ConfigService) {
    this.apiKey = config.getOrThrow<string>('E2B_API_KEY');
  }

  /** Spins up a new E2B sandbox and stores a reference by its ID. */
  async create(): Promise<{ sandboxId: string }> {
    const sandbox = await Sandbox.create({
      apiKey: this.apiKey,
      timeoutMs: this.SANDBOX_TIMEOUT_MS,
    });
    this.sandboxes.set(sandbox.sandboxId, sandbox);
    this.logger.log(`Sandbox created: ${sandbox.sandboxId}`);
    return { sandboxId: sandbox.sandboxId };
  }

  /** Retrieves a tracked sandbox by ID, throwing if not found. */
  get(sandboxId: string): Sandbox {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found or already terminated`);
    }
    return sandbox;
  }

  /** Runs a shell command inside the sandbox, returning result and exit code. */
  async exec(sandboxId: string, cmd: string, timeoutMs?: number): Promise<CommandResult> {
    const sandbox = this.get(sandboxId);
    try {
      const result = await sandbox.commands.run(cmd, timeoutMs !== undefined ? { timeoutMs } : undefined);
      return {
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        exitCode: result.exitCode ?? 0,
      };
    } catch (err: any) {
      // E2B throws on non-zero exit codes rather than returning a result object.
      // Extract exit code from message like "exit status 128" and surface stdout/stderr.
      const exitCodeMatch = String(err?.message || '').match(/exit status (\d+)/);
      const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1], 10) : 1;
      this.logger.debug(`exec threw (exit ${exitCode}): ${err?.message}`);
      return {
        stdout: err?.stdout ?? '',
        stderr: err?.stderr ?? err?.message ?? String(err),
        exitCode,
      };
    }
  }

  /** Reads the contents of a file from the sandbox filesystem. */
  async readFile(sandboxId: string, path: string): Promise<string> {
    const sandbox = this.get(sandboxId);
    return sandbox.files.read(path);
  }

  /** Writes content to a file in the sandbox filesystem. */
  async writeFile(sandboxId: string, path: string, content: string): Promise<void> {
    const sandbox = this.get(sandboxId);
    await sandbox.files.write(path, content);
  }

  /** Resets the sandbox TTL to prevent timeout during long-running operations. */
  async keepAlive(sandboxId: string, timeoutMs?: number): Promise<void> {
    const sandbox = this.get(sandboxId);
    await sandbox.setTimeout(timeoutMs ?? this.SANDBOX_TIMEOUT_MS);
    this.logger.debug(`Sandbox ${sandboxId} timeout reset to ${(timeoutMs ?? this.SANDBOX_TIMEOUT_MS) / 1000}s`);
  }

  /** Kills the sandbox and removes it from the tracking map. */
  async kill(sandboxId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return; // already killed or never existed
    try {
      await sandbox.kill();
      this.logger.log(`Sandbox killed: ${sandboxId}`);
    } catch (err) {
      // Log but don't rethrow — cleanup errors shouldn't mask the real job result
      this.logger.warn(`Failed to kill sandbox ${sandboxId}: ${String(err)}`);
    } finally {
      this.sandboxes.delete(sandboxId);
    }
  }

  /** Kills all tracked sandboxes on application shutdown. */
  async onModuleDestroy(): Promise<void> {
    const ids = [...this.sandboxes.keys()];
    await Promise.allSettled(ids.map((id) => this.kill(id)));
    this.logger.log(`Cleaned up ${ids.length} sandbox(es) on shutdown`);
  }
}
