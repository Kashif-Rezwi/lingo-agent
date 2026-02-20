import { tool } from 'ai';
import { z } from 'zod';
import { SandboxService } from '../../sandbox/sandbox.service.js';
import { McpService } from '../../mcp/mcp.service.js';
import { patchNextConfig, patchRootLayout, generateI18nConfig } from '../../common/utils/file-patcher.js';
import type { EmitFn } from '../../common/types/index.js';

const inputSchema = z.object({
  sandboxId: z.string().describe('E2B sandbox ID'),
  workDir: z.string().describe('Absolute path to the cloned repo'),
  framework: z.string().describe('Framework identifier, e.g. nextjs-app-router'),
  locales: z.array(z.string()).describe('Target locale codes, e.g. ["fr", "ar", "ja"]'),
  layoutPath: z.string().describe('Absolute path to root layout file'),
  nextConfigPath: z.string().describe('Absolute path to next.config file'),
});

/** Tool 4 — setup_lingo: Applies configuration (i18n.json, next.config, layout.tsx). Queries MCP for instructions. */
export function createSetupLingoTool(sandbox: SandboxService, mcp: McpService, emit: EmitFn) {
  return tool({
    description:
      'Configures Lingo.dev: writes i18n.json, patches next.config, and injects LingoProvider.',
    inputSchema,
    execute: async ({ sandboxId, workDir, framework, locales, layoutPath, nextConfigPath }) => {
      emit({ level: 'info', message: 'Configuring Lingo.dev…', timestamp: new Date(), step: 'setup_lingo' });

      // Query MCP for verified instructions (non-blocking if unavailable)
      if (mcp.isConnected) {
        try {
          const instructions = await mcp.getSetupInstructions(framework, locales);
          emit({
            level: 'info',
            message: `MCP setup instructions received (${instructions.length} chars)`,
            timestamp: new Date(),
            step: 'setup_lingo',
          });
        } catch {
          emit({
            level: 'warn',
            message: 'MCP instructions unavailable — using built-in configuration.',
            timestamp: new Date(),
            step: 'setup_lingo',
          });
        }
      }

      const modifiedFiles: string[] = [];

      // 1. Write i18n.json
      await sandbox.writeFile(sandboxId, `${workDir}/i18n.json`, generateI18nConfig('en', locales));
      modifiedFiles.push(`${workDir}/i18n.json`);
      emit({ level: 'info', message: 'Written i18n.json', timestamp: new Date(), step: 'setup_lingo' });

      // 2. Patch next.config
      const nextConfigContent = await sandbox.readFile(sandboxId, nextConfigPath);
      await sandbox.writeFile(sandboxId, nextConfigPath, patchNextConfig(nextConfigContent));
      modifiedFiles.push(nextConfigPath);
      emit({ level: 'info', message: `Patched ${nextConfigPath} with withLingo`, timestamp: new Date(), step: 'setup_lingo' });

      // 3. Patch root layout
      const layoutContent = await sandbox.readFile(sandboxId, layoutPath);
      await sandbox.writeFile(sandboxId, layoutPath, patchRootLayout(layoutContent, locales));
      modifiedFiles.push(layoutPath);
      emit({ level: 'info', message: `Injected LingoProvider into ${layoutPath}`, timestamp: new Date(), step: 'setup_lingo' });

      emit({
        level: 'success',
        message: `Lingo.dev configured — ${modifiedFiles.length} files modified`,
        timestamp: new Date(),
        step: 'setup_lingo',
      });

      return { modifiedFiles };
    },
  });
}
