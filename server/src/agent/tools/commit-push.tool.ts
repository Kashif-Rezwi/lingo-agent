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
      wordCounts: z.record(z.string(), z.number()).optional().describe('Word counts per locale from install_and_translate'),
    }),
    execute: async ({ sandboxId, workDir, repoUrl, githubToken, locales, nextConfigPath, layoutPath, wordCounts = {} }) => {
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
          [...optionalFilePaths, ...localeFilePaths].map(async (absPath) => {
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
      const prBody = buildPrBody(locales, fileChanges.length, wordCounts);
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

function buildPrBody(locales: string[], fileCount: number, wordCounts: Record<string, number> = {}): string {
  const totalWords = Object.values(wordCounts).reduce((a, b) => a + b, 0);
  const wordCountLines = locales
    .filter((l) => wordCounts[l] !== undefined)
    .map((l) => `  - \`${l}\`: ${wordCounts[l].toLocaleString()} words`)
    .join('\n');

  return `## 🌍 Multilingual Support Added by LingoAgent

This PR was automatically generated by **LingoAgent** — [lingo.dev](https://lingo.dev)

### What changed
- **\`i18n.json\`** — Lingo.dev locale config (source: \`en\`, targets: ${locales.map((l) => `\`${l}\``).join(', ')})
- **\`app/i18n/provider.tsx\`** — Self-contained \`LanguageProvider\` React context (zero external deps)
- **\`app/i18n/switcher.tsx\`** — Floating language-switcher button (portal-rendered, fixed bottom-right)
- **\`app/i18n/text-translator.tsx\`** — Runtime DOM text-node translator activated on locale switch
- **\`app/layout.tsx\`** — Root layout wrapped with \`<LanguageProvider>\`, \`<TextTranslator>\`, and \`<LanguageSwitcher>\`
- **\`public/locales/*.json\`** — AI-translated locale files for ${locales.length} language(s)

### Translation stats
${totalWords > 0 ? `**${totalWords.toLocaleString()} total words** translated across ${locales.length} language(s):\n${wordCountLines}` : `${fileCount} files modified in total.`}

### How it works
Translations are loaded at runtime from \`/locales/<locale>.json\`. When a visitor switches language, the \`TextTranslator\` walks the DOM and replaces all matched text nodes and HTML attributes (placeholder, title, alt, aria-label) with the translated versions — no page reload required.

> **Scope note:** This runtime covers JSX text nodes and translatable HTML attributes. Strings inside JavaScript variables, API responses, or toast messages are not translated in this PR.

### Next steps
1. Review the changes in this PR
2. Open the [preview deployment]() to see the live language switcher
3. Merge when ready — add new strings to \`public/locales/en.json\` and re-run LingoAgent to keep translations in sync

---
*Generated by [LingoAgent](https://lingo.dev) — multilingual support in minutes, not days.*`;
}
