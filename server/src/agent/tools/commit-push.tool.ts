import { tool } from 'ai';
import { z } from 'zod';
import { SandboxService } from '../../sandbox/sandbox.service.js';
import { GithubService } from '../../github/github.service.js';
import { parseGitHubUrl } from '../../common/utils/url-parser.js';
import type { EmitFn } from '../../common/types/index.js';

/** Tool 6 — commit_and_push: Commits sandbox changes (configs, locales) to a new GitHub branch and opens a PR. */
export function createCommitPushTool(
  sandbox: SandboxService,
  github: GithubService,
  emit: EmitFn,
) {
  return tool({
    description:
      'Reads modified files from the sandbox, creates a branch on GitHub, commits all changes ' +
      'atomically via the Git Data API, and opens a pull request. Returns the PR URL.',
    inputSchema: z.object({
      sandboxId: z.string().describe('E2B sandbox ID'),
      workDir: z.string().describe('Absolute path to the cloned repo'),
      repoUrl: z.string().describe('GitHub repository URL'),
      githubToken: z.string().describe('GitHub personal access token'),
      locales: z.array(z.string()).describe('Target locale codes that were translated'),
      nextConfigPath: z.string().describe('Absolute path to next.config file'),
      layoutPath: z.string().describe('Absolute path to root layout file'),
    }),
    execute: async ({ sandboxId, workDir, repoUrl, githubToken, locales, nextConfigPath, layoutPath }) => {
      const { owner, repo } = parseGitHubUrl(repoUrl);
      const BRANCH_NAME = `lingo/add-multilingual-${Date.now()}`;

      emit({ level: 'info', message: 'Preparing files for commit…', timestamp: new Date(), step: 'commit_and_push' });

      // ── 1. Collect all files to commit ──────────────────────────────────
      // Convert absolute sandbox paths to repo-relative paths
      const toRelative = (abs: string) => abs.replace(`${workDir}/`, '');

      const layoutDir = layoutPath.substring(0, layoutPath.lastIndexOf('/'));

      // Required files — must exist; will throw on missing to surface problems early
      const requiredFilePaths = [
        `${workDir}/package.json`,
        `${workDir}/i18n.json`,
        nextConfigPath,
        layoutPath,
      ];

      // Possible lockfiles — only one will exist, rest are silently skipped
      const lockFilePaths: string[] = [];

      // Optional runtime files — custom i18n provider, switcher, translator
      // Must be same directory as layout.tsx so relative imports resolve correctly
      const optionalFilePaths = [
        `${layoutDir}/i18n/provider.tsx`,
        `${layoutDir}/i18n/switcher.tsx`,
        `${layoutDir}/i18n/text-translator.tsx`,
      ];

      // All generated locale files (served as static assets from public/locales/)
      const { stdout: localeFilesRaw } = await sandbox.exec(
        sandboxId,
        `find ${workDir}/public/locales -type f 2>/dev/null || echo ""`,
      );
      const localeFilePaths = localeFilesRaw
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);

      // Read required files — throws on missing
      const requiredChanges = await Promise.all(
        requiredFilePaths.map(async (absPath) => ({
          path: toRelative(absPath),
          content: await sandbox.readFile(sandboxId, absPath),
        })),
      );

      // Read optional files — silently skip missing ones
      const optionalChanges = (
        await Promise.all(
          [...lockFilePaths, ...optionalFilePaths, ...localeFilePaths].map(async (absPath) => {
            try {
              const content = await sandbox.readFile(sandboxId, absPath);
              return { path: toRelative(absPath), content };
            } catch {
              return null;
            }
          }),
        )
      ).filter((f): f is { path: string; content: string } => f !== null);

      const fileChanges = [...requiredChanges, ...optionalChanges];



      emit({
        level: 'info',
        message: `Read ${fileChanges.length} file(s) — creating branch on GitHub…`,
        timestamp: new Date(),
        step: 'commit_and_push',
      });

      // ── 2. Get base SHA and create branch ───────────────────────────────
      const defaultBranch = await github.getDefaultBranch(owner, repo, githubToken);
      const baseSha = await github.getLatestCommitSha(owner, repo, defaultBranch, githubToken);
      await github.createBranch(owner, repo, BRANCH_NAME, baseSha, githubToken);

      emit({
        level: 'info',
        message: `Branch created: ${BRANCH_NAME}`,
        timestamp: new Date(),
        step: 'commit_and_push',
      });

      // ── 3. Commit all files atomically ──────────────────────────────────
      await github.commitFiles(
        owner,
        repo,
        BRANCH_NAME,
        baseSha,
        fileChanges,
        `feat(i18n): add multilingual support via Lingo.dev\n\nAdded support for: ${locales.join(', ')}`,
        githubToken,
      );

      emit({
        level: 'info',
        message: 'Changes committed — opening pull request…',
        timestamp: new Date(),
        step: 'commit_and_push',
      });

      // ── 4. Open the pull request ─────────────────────────────────────────
      const prBody = buildPrBody(locales, fileChanges.length);
      const { url: prUrl } = await github.createPullRequest(
        owner,
        repo,
        BRANCH_NAME,
        defaultBranch,
        '🌍 feat(i18n): Add multilingual support via Lingo.dev',
        prBody,
        githubToken,
      );

      emit({
        level: 'success',
        message: `Pull request opened: ${prUrl}`,
        timestamp: new Date(),
        step: 'commit_and_push',
      });

      return { branchName: BRANCH_NAME, prUrl };
    },
  });
}

function buildPrBody(locales: string[], fileCount: number): string {
  return `## 🌍 Multilingual Support Added by LingoAgent

This PR was automatically generated by [LingoAgent](https://github.com/lingoagent).

### What changed
- **\`i18n.json\`** — Lingo.dev configuration (source: \`en\`, targets: ${locales.map((l) => `\`${l}\``).join(', ')})
- **\`next.config.*\`** — Wrapped with \`withLingo()\` to enable the build-time compiler
- **\`app/layout.tsx\`** — Root layout wrapped with \`<LingoProvider>\`
- **Locale files** — AI-translated strings for ${locales.length} language(s)

### Translation scope
${fileCount} files modified in total.

> **Note:** The Lingo.dev Compiler translates JSX text nodes at build time. Strings in JavaScript variables, API responses, or toast messages are not covered in this PR.

### Next steps
1. Review the changes in this PR
2. Run the app locally to verify translations render correctly
3. Merge when ready — Lingo.dev will keep translations in sync on future pushes via the CLI

---
*Generated by LingoAgent — [lingo.dev](https://lingo.dev)*`;
}
