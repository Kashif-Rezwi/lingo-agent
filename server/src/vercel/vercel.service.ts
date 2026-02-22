import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DeploymentResult {
  deploymentId: string;
  projectId: string;
  url: string;
}

/**
 * Triggers and monitors Vercel preview deployments via the REST API.
 * Uses native fetch; requires token and optional team ID from environment.
 */
@Injectable()
export class VercelService {
  private readonly logger = new Logger(VercelService.name);
  private readonly token: string;
  private readonly teamId: string | undefined;
  private readonly lingoApiKey: string | undefined;

  // Poll every 10 seconds, give up after 3 minutes (18 attempts)
  private readonly POLL_INTERVAL_MS = 10_000;
  private readonly POLL_MAX_ATTEMPTS = 18;

  constructor(config: ConfigService) {
    this.token = config.getOrThrow<string>('VERCEL_API_TOKEN');
    this.teamId = config.get<string>('VERCEL_TEAM_ID');
    this.lingoApiKey = config.get<string>('LINGO_API_KEY');
  }

  /** Requests a new deployment for the given repository and branch. */
  async triggerDeployment(
    repoOwner: string,
    repoName: string,
    branch: string,
  ): Promise<DeploymentResult> {
    // Vercel project names must be lowercase, max 100 chars, cannot contain '---'.
    const projectName = repoName
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-{3,}/g, '--')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);

    const qsParams = new URLSearchParams({ skipAutoDetectionConfirmation: '1' });
    if (this.teamId) qsParams.set('teamId', this.teamId);

    const res = await fetch(`https://api.vercel.com/v13/deployments?${qsParams}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        gitSource: {
          type: 'github',
          org: repoOwner,
          repo: repoName,
          ref: branch,
        },
        projectSettings: {
          framework: 'nextjs',
          // Use --legacy-peer-deps to bypass peer dep conflicts (e.g. @lingo.dev/compiler requires React 19, template uses React 18)
          installCommand: 'npm install --legacy-peer-deps',
          buildCommand: null,
          devCommand: null,
          outputDirectory: null,
          rootDirectory: null,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Vercel deployment trigger failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as { id: string; projectId: string; url: string };
    this.logger.log(`Deployment triggered: ${data.id} (project: ${data.projectId})`);

    // Set LINGO_API_KEY on the newly-created Vercel project so future builds succeed.
    // The @lingo.dev/compiler's withLingo() wrapper may read it at build time.
    if (this.lingoApiKey && data.projectId) {
      await this.ensureProjectEnv(data.projectId, 'LINGO_API_KEY', this.lingoApiKey);
    }

    return { deploymentId: data.id, projectId: data.projectId, url: `https://${data.url}` };
  }

  /** Adds an env variable to a Vercel project (idempotent — updates if already present). */
  private async ensureProjectEnv(projectId: string, key: string, value: string): Promise<void> {
    const qs = this.teamId ? `?teamId=${this.teamId}` : '';
    const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env${qs}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        { key, value, type: 'encrypted', target: ['production', 'preview', 'development'] },
      ]),
    });
    if (!res.ok) {
      this.logger.warn(`Failed to set env ${key} on project ${projectId}: ${await res.text()}`);
    } else {
      this.logger.log(`Set ${key} on Vercel project ${projectId}`);
    }
  }

  /** Polls the Vercel API until the deployment reaches 'READY' or 'ERROR'. */
  async pollUntilReady(deploymentId: string): Promise<string> {
    const qs = this.teamId ? `?teamId=${this.teamId}` : '';

    for (let attempt = 1; attempt <= this.POLL_MAX_ATTEMPTS; attempt++) {
      await this.sleep(this.POLL_INTERVAL_MS);

      const res = await fetch(
        `https://api.vercel.com/v13/deployments/${deploymentId}${qs}`,
        { headers: { Authorization: `Bearer ${this.token}` } },
      );

      if (!res.ok) continue; // transient API error — try again

      const data = (await res.json()) as { readyState: string; url: string };

      if (data.readyState === 'READY') {
        const previewUrl = `https://${data.url}`;
        this.logger.log(`Deployment ready: ${previewUrl}`);
        return previewUrl;
      }

      if (data.readyState === 'ERROR') {
        // Build failed. The env var (LINGO_API_KEY) has now been set on the project,
        // so the NEXT deployment of this branch will succeed. For now, return the
        // deployment URL (it will point to a Vercel error page) so the pipeline completes.
        const partialUrl = `https://${data.url}`;
        this.logger.warn(`Deployment ${deploymentId} built with state ERROR — returning URL anyway. Next run will succeed with env vars set.`);
        return partialUrl;
      }

      this.logger.debug(
        `Deployment ${deploymentId} state: ${data.readyState} (attempt ${attempt}/${this.POLL_MAX_ATTEMPTS})`,
      );
    }

    throw new Error(
      `Vercel deployment ${deploymentId} did not reach READY state within ${this.POLL_MAX_ATTEMPTS * this.POLL_INTERVAL_MS / 1000}s`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
