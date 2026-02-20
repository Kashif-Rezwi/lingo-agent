import { tool } from 'ai';
import { z } from 'zod';
import { SandboxService } from '../../sandbox/sandbox.service.js';
import type { EmitFn } from '../../common/types/index.js';

/** Tool 5 — install_and_translate: Installs @lingo.dev/compiler and runs translation engine inside sandbox. */
export function createInstallTranslateTool(
  sandbox: SandboxService,
  lingoApiKey: string,
  emit: EmitFn,
) {
  return tool({
    description:
      'Installs @lingo.dev/compiler via npm inside the sandbox, then runs the Lingo.dev CLI ' +
      'to generate translated locale files for all configured target languages.',
    inputSchema: z.object({
      sandboxId: z.string().describe('E2B sandbox ID'),
      workDir: z.string().describe('Absolute path to the cloned repo'),
    }),
    execute: async ({ sandboxId, workDir }) => {
      // Step 1: Install compiler
      emit({
        level: 'info',
        message: 'Installing @lingo.dev/compiler (this may take 60–90 seconds)…',
        timestamp: new Date(),
        step: 'install_and_translate',
      });

      const installResult = await sandbox.exec(
        sandboxId,
        `cd ${workDir} && npm install @lingo.dev/compiler --save 2>&1`,
      );

      if (installResult.exitCode !== 0) {
        throw new Error(`npm install failed: ${installResult.stderr || installResult.stdout}`);
      }

      emit({
        level: 'success',
        message: '@lingo.dev/compiler installed',
        timestamp: new Date(),
        step: 'install_and_translate',
      });

      // Step 2: Run the Lingo.dev CLI translation engine
      emit({
        level: 'info',
        message: 'Running Lingo.dev translation engine…',
        timestamp: new Date(),
        step: 'install_and_translate',
      });

      const translateResult = await sandbox.exec(
        sandboxId,
        `cd ${workDir} && LINGO_API_KEY=${lingoApiKey} npx lingo.dev@latest run 2>&1`,
      );

      if (translateResult.exitCode !== 0) {
        throw new Error(
          `lingo.dev run failed: ${translateResult.stderr || translateResult.stdout}`,
        );
      }

      // Discover which locale directories were generated
      const { stdout: localeListRaw } = await sandbox.exec(
        sandboxId,
        `ls ${workDir}/locales 2>/dev/null || echo ""`,
      );
      const generatedLocales = localeListRaw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      emit({
        level: 'success',
        message: `Translation complete — ${generatedLocales.length} locale(s) generated: ${generatedLocales.join(', ')}`,
        timestamp: new Date(),
        step: 'install_and_translate',
      });

      return { generatedLocales, wordCounts: {} };
    },
  });
}
