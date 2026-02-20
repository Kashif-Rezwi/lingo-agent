import { tool } from 'ai';
import { z } from 'zod';
import { SandboxService } from '../../sandbox/sandbox.service.js';
import { parseGitHubUrl, buildAuthenticatedCloneUrl } from '../../common/utils/url-parser.js';
import type { EmitFn } from '../../common/types/index.js';

const inputSchema = z.object({
  repoUrl: z.string().describe('Full GitHub repository URL, e.g. https://github.com/owner/repo'),
  githubToken: z.string().describe('GitHub personal access token for authenticated clone'),
});

/** Tool 1 — clone_repo: Clones repo into an E2B sandbox. Returns sandboxId used by all other tools. */
export function createCloneRepoTool(sandbox: SandboxService, emit: EmitFn) {
  return tool({
    description:
      'Spins up an isolated E2B cloud sandbox and clones the GitHub repository into /workspace. ' +
      'Returns the sandboxId and workDir that all subsequent tools must use.',
    inputSchema,
    execute: async ({ repoUrl, githubToken }) => {
      emit({ level: 'info', message: `Cloning repository: ${repoUrl}`, timestamp: new Date(), step: 'clone_repo' });

      const { owner, repo } = parseGitHubUrl(repoUrl);
      const cloneUrl = buildAuthenticatedCloneUrl(owner, repo, githubToken);

      const { sandboxId } = await sandbox.create();
      emit({ level: 'info', message: 'Sandbox created — cloning…', timestamp: new Date(), step: 'clone_repo' });

      const workDir = '/workspace';
      const result = await sandbox.exec(sandboxId, `git clone ${cloneUrl} ${workDir}`);

      if (result.exitCode !== 0) {
        throw new Error(`git clone failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`);
      }

      emit({ level: 'success', message: `Repository cloned into ${workDir}`, timestamp: new Date(), step: 'clone_repo' });
      return { sandboxId, workDir };
    },
  });
}
