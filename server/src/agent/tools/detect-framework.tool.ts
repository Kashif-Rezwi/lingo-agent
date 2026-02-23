import { tool } from 'ai';
import { z } from 'zod';
import { SandboxService } from '../../sandbox/sandbox.service.js';
import { detectFramework } from '../../common/utils/framework-detector.js';
import type { EmitFn } from '../../common/types/index.js';

const inputSchema = z.object({
  sandboxId: z.string().describe('E2B sandbox ID from clone_repo'),
  workDir: z.string().describe('Absolute path to the cloned repo, e.g. /workspace'),
});

/** Tool 2 — detect_framework: Detects Next.js App Router from package.json/files. Throws if unsupported. */
export function createDetectFrameworkTool(sandbox: SandboxService, emit: EmitFn) {
  return tool({
    description:
      'Reads package.json and the file tree to detect the framework. ' +
      'Throws if the framework is not Next.js App Router — only that is supported.',
    inputSchema,
    execute: async ({ sandboxId, workDir }) => {
      emit({ level: 'info', message: 'Detecting framework…', timestamp: new Date(), step: 'detect_framework' });

      const pkgRaw = await sandbox.readFile(sandboxId, `${workDir}/package.json`);
      const pkg = JSON.parse(pkgRaw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

      const { stdout: fileListRaw } = await sandbox.exec(
        sandboxId,
        `find ${workDir} -type f -not -path "*/node_modules/*" -not -path "*/.git/*"`,
      );
      const filePaths = fileListRaw.split('\n').filter(Boolean);

      const { framework, layoutPath } = detectFramework(allDeps, filePaths);

      if (framework !== 'nextjs-app-router') {
        throw new Error(
          `Unsupported framework: "${framework}". ` +
          `LingoAgent only supports Next.js App Router repositories.`,
        );
      }

      emit({
        level: 'success',
        message: `Detected: Next.js App Router (layout at ${layoutPath})`,
        timestamp: new Date(),
        step: 'detect_framework',
      });

      return { framework, layoutPath: layoutPath! };
    },
  });
}
