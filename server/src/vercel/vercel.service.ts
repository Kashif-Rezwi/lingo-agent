import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DeploymentResult {
  deploymentId: string;
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

  // Poll every 10 seconds, give up after 3 minutes (18 attempts)
  private readonly POLL_INTERVAL_MS = 10_000;
  private readonly POLL_MAX_ATTEMPTS = 18;

  constructor(config: ConfigService) {
    this.token = config.getOrThrow<string>('VERCEL_API_TOKEN');
    this.teamId = config.get<string>('VERCEL_TEAM_ID');
  }

  /** Requests a new deployment for the given repository and branch. */
  async triggerDeployment(
    repoOwner: string,
    repoName: string,
    branch: string,
  ): Promise<DeploymentResult> {
    const qs = this.teamId ? `?teamId=${this.teamId}` : '';
    const res = await fetch(`https://api.vercel.com/v13/deployments${qs}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repoName,
        gitSource: {
          type: 'github',
          org: repoOwner,
          repo: repoName,
          ref: branch,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Vercel deployment trigger failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as { id: string; url: string };
    this.logger.log(`Deployment triggered: ${data.id}`);
    return { deploymentId: data.id, url: `https://${data.url}` };
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
        throw new Error(`Vercel deployment ${deploymentId} failed with state ERROR`);
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
