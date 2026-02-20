import { tool } from 'ai';
import { z } from 'zod';
import { SandboxService } from '../../sandbox/sandbox.service.js';
import { detectConflictingI18n } from '../../common/utils/framework-detector.js';
import type { EmitFn } from '../../common/types/index.js';

const inputSchema = z.object({
  sandboxId: z.string().describe('E2B sandbox ID from clone_repo'),
  workDir: z.string().describe('Absolute path to the cloned repo'),
  layoutPath: z.string().describe('Layout file path from detect_framework'),
});

/** Tool 3 — analyze_repo: Scans for conflicts, config files, and JSX files in the repo. Throws if a conflicting i18n library is found. */
export function createAnalyzeRepoTool(sandbox: SandboxService, emit: EmitFn) {
  return tool({
    description:
      'Scans the repository for existing i18n libraries and locates key config files. ' +
      'Throws if a conflicting i18n library is detected.',
    inputSchema,
    execute: async ({ sandboxId, workDir, layoutPath }) => {
      emit({ level: 'info', message: 'Analyzing repository structure…', timestamp: new Date(), step: 'analyze_repo' });

      const pkgRaw = await sandbox.readFile(sandboxId, `${workDir}/package.json`);
      const pkg = JSON.parse(pkgRaw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

      const conflictingLib = detectConflictingI18n(allDeps);
      if (conflictingLib) {
        throw new Error(
          `Conflicting i18n library detected: "${conflictingLib}". ` +
          `Lingo.dev Compiler is incompatible with existing i18n setups. ` +
          `Remove "${conflictingLib}" before running LingoAgent.`,
        );
      }

      const { exitCode: i18nJsonExists } = await sandbox.exec(sandboxId, `test -f ${workDir}/i18n.json`);
      const hasExistingI18n = i18nJsonExists === 0;

      if (hasExistingI18n) {
        emit({
          level: 'warn',
          message: 'Existing i18n.json found — it will be overwritten.',
          timestamp: new Date(),
          step: 'analyze_repo',
        });
      }

      const nextConfigPath = await findNextConfig(sandboxId, workDir, sandbox);

      const { stdout: jsxCountRaw } = await sandbox.exec(
        sandboxId,
        `find ${workDir} -type f \\( -name "*.tsx" -o -name "*.jsx" \\) -not -path "*/node_modules/*" | wc -l`,
      );
      const jsxFileCount = parseInt(jsxCountRaw.trim(), 10) || 0;

      emit({
        level: 'success',
        message: `Analysis complete — ${jsxFileCount} JSX/TSX files, next.config at ${nextConfigPath}`,
        timestamp: new Date(),
        step: 'analyze_repo',
      });

      return { hasExistingI18n, existingI18nLibrary: null, layoutPath, nextConfigPath, jsxFileCount };
    },
  });
}

async function findNextConfig(sandboxId: string, workDir: string, sandbox: SandboxService): Promise<string> {
  const candidates = [
    `${workDir}/next.config.ts`,
    `${workDir}/next.config.js`,
    `${workDir}/next.config.mjs`,
  ];
  for (const candidate of candidates) {
    const { exitCode } = await sandbox.exec(sandboxId, `test -f ${candidate}`);
    if (exitCode === 0) return candidate;
  }
  throw new Error(
    'Could not locate next.config.ts, next.config.js, or next.config.mjs. ' +
    'This does not appear to be a valid Next.js project.',
  );
}
