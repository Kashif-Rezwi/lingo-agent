import { tool } from 'ai';
import { z } from 'zod';
import { VercelService } from '../../vercel/vercel.service.js';
import { parseGitHubUrl } from '../../common/utils/url-parser.js';
import type { EmitFn } from '../../common/types/index.js';

/** Tool 7 — trigger_preview: Triggers Vercel deployment, polls until live, returns URL. No sandbox dependency. */
export function createTriggerPreviewTool(vercel: VercelService, emit: EmitFn) {
  return tool({
    description:
      'Triggers a Vercel preview deployment for the new branch and polls until ready. ' +
      'Returns the preview URL when the deployment is live.',
    inputSchema: z.object({
      repoUrl: z.string().describe('GitHub repository URL'),
      branchName: z.string().describe('Branch name to deploy, e.g. lingo/add-multilingual-support'),
    }),
    execute: async ({ repoUrl, branchName }) => {
      const { owner, repo } = parseGitHubUrl(repoUrl);

      emit({
        level: 'info',
        message: `Triggering Vercel preview deployment for branch: ${branchName}`,
        timestamp: new Date(),
        step: 'trigger_preview',
      });

      const { deploymentId } = await vercel.triggerDeployment(owner, repo, branchName);

      emit({
        level: 'info',
        message: `Deployment started (ID: ${deploymentId}) — polling for ready state…`,
        timestamp: new Date(),
        step: 'trigger_preview',
      });

      const previewUrl = await vercel.pollUntilReady(deploymentId);

      emit({
        level: 'success',
        message: `Preview deployment live: ${previewUrl}`,
        timestamp: new Date(),
        step: 'trigger_preview',
      });

      return { previewUrl };
    },
  });
}
