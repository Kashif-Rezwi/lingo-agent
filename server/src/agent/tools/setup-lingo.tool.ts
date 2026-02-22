import { tool } from 'ai';
import { z } from 'zod';
import { SandboxService } from '../../sandbox/sandbox.service.js';
import { McpService } from '../../mcp/mcp.service.js';
import {
  patchNextConfig,
  patchNextConfigFull,
  patchRootLayout,
  patchRootLayoutFull,
  generateI18nConfig,
  generateI18nProvider,
  generateLanguageSwitcher,
  generateTextTranslator,
} from '../../common/utils/file-patcher.js';
import type { EmitFn } from '../../common/types/index.js';

const inputSchema = z.object({
  sandboxId: z.string().describe('E2B sandbox ID'),
  workDir: z.string().describe('Absolute path to the cloned repo'),
  framework: z.string().describe('Framework identifier, e.g. nextjs-app-router'),
  locales: z.array(z.string()).describe('Target locale codes, e.g. ["fr", "ar", "ja"]'),
  layoutPath: z.string().describe('Absolute path to root layout file'),
  nextConfigPath: z.string().describe('Absolute path to next.config file'),
});

/** Parses a semver range like "^15.0.0", ">=19.0.0", "19", "15.1.2" and returns the major version number. */
function parseMajorVersion(range: string): number {
  const match = range.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Detects whether the project uses Next.js 15+ AND React 19+ (full @lingo.dev/compiler support). */
async function detectFullRuntimeSupport(
  sandbox: SandboxService,
  sandboxId: string,
  workDir: string,
): Promise<{ useFullRuntime: boolean; nextMajor: number; reactMajor: number }> {
  try {
    const raw = await sandbox.readFile(sandboxId, `${workDir}/package.json`);
    const pkg = JSON.parse(raw);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    const nextRange: string = deps['next'] ?? '0';
    const reactRange: string = deps['react'] ?? '0';
    const nextMajor = parseMajorVersion(nextRange);
    const reactMajor = parseMajorVersion(reactRange);

    return {
      useFullRuntime: nextMajor >= 15 && reactMajor >= 19,
      nextMajor,
      reactMajor,
    };
  } catch {
    return { useFullRuntime: false, nextMajor: 0, reactMajor: 0 };
  }
}

/** Adds @lingo.dev/compiler to package.json dependencies directly. Avoids npm pkg set which fails on dotted names. */
async function addLingoCompilerDep(
  sandbox: SandboxService,
  sandboxId: string,
  workDir: string,
): Promise<void> {
  const raw = await sandbox.readFile(sandboxId, `${workDir}/package.json`);
  const pkg = JSON.parse(raw);
  pkg.dependencies = pkg.dependencies ?? {};
  pkg.dependencies['@lingo.dev/compiler'] = 'latest';
  await sandbox.writeFile(sandboxId, `${workDir}/package.json`, JSON.stringify(pkg, null, 2));
}

/** Tool 4 — setup_lingo: Auto-detects runtime strategy and configures the project accordingly. */
export function createSetupLingoTool(sandbox: SandboxService, mcp: McpService, emit: EmitFn) {
  return tool({
    description:
      'Configures Lingo.dev with automatic runtime detection: ' +
      'Next.js 15+ / React 19 projects get the full @lingo.dev/compiler integration; ' +
      'older projects get a custom React context-based language switcher (no external deps).',
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

      // ── Auto-detect runtime strategy ──────────────────────────────────────
      const { useFullRuntime, nextMajor, reactMajor } = await detectFullRuntimeSupport(
        sandbox, sandboxId, workDir,
      );

      emit({
        level: 'info',
        message: useFullRuntime
          ? `Detected Next.js ${nextMajor} / React ${reactMajor} → using FULL @lingo.dev/compiler runtime`
          : `Detected Next.js ${nextMajor} / React ${reactMajor} → using CUSTOM runtime (React 18 compatible)`,
        timestamp: new Date(),
        step: 'setup_lingo',
      });

      const modifiedFiles: string[] = [];

      // 1. Write i18n.json
      await sandbox.writeFile(sandboxId, `${workDir}/i18n.json`, generateI18nConfig('en', locales));
      modifiedFiles.push(`${workDir}/i18n.json`);
      emit({ level: 'info', message: 'Written i18n.json', timestamp: new Date(), step: 'setup_lingo' });

      if (useFullRuntime) {
        // ── FULL RUNTIME: @lingo.dev/compiler (Next.js 15+ / React 19) ──────
        // Add @lingo.dev/compiler to package.json
        await addLingoCompilerDep(sandbox, sandboxId, workDir);
        modifiedFiles.push(`${workDir}/package.json`);

        // Patch next.config with withLingo()
        const nextConfigContent = await sandbox.readFile(sandboxId, nextConfigPath);
        await sandbox.writeFile(sandboxId, nextConfigPath, patchNextConfigFull(nextConfigContent));
        modifiedFiles.push(nextConfigPath);
        emit({ level: 'info', message: `Patched ${nextConfigPath} with withLingo()`, timestamp: new Date(), step: 'setup_lingo' });

        // Patch root layout with official LingoProvider
        const layoutContent = await sandbox.readFile(sandboxId, layoutPath);
        await sandbox.writeFile(sandboxId, layoutPath, patchRootLayoutFull(layoutContent, locales));
        modifiedFiles.push(layoutPath);
        emit({ level: 'info', message: `Injected LingoProvider into ${layoutPath}`, timestamp: new Date(), step: 'setup_lingo' });

      } else {
        // ── CUSTOM RUNTIME: pure React context (React 18 / Next.js 14) ──────
        // Patch next.config (no-op for custom runtime)
        const nextConfigContent = await sandbox.readFile(sandboxId, nextConfigPath);
        await sandbox.writeFile(sandboxId, nextConfigPath, patchNextConfig(nextConfigContent));
        modifiedFiles.push(nextConfigPath);

        // Write the custom LanguageProvider + LanguageSwitcher (no external packages)
        await sandbox.exec(sandboxId, `mkdir -p ${workDir}/app/i18n`);
        const providerPath = `${workDir}/app/i18n/provider.tsx`;
        const switcherPath = `${workDir}/app/i18n/switcher.tsx`;
        const translatorPath = `${workDir}/app/i18n/text-translator.tsx`;
        await sandbox.writeFile(sandboxId, providerPath, generateI18nProvider());
        await sandbox.writeFile(sandboxId, switcherPath, generateLanguageSwitcher());
        await sandbox.writeFile(sandboxId, translatorPath, generateTextTranslator());
        modifiedFiles.push(providerPath, switcherPath, translatorPath);
        emit({ level: 'info', message: 'Written LanguageProvider + LanguageSwitcher + TextTranslator to app/i18n/', timestamp: new Date(), step: 'setup_lingo' });

        // Patch root layout to inject custom LanguageProvider
        const layoutContent = await sandbox.readFile(sandboxId, layoutPath);
        await sandbox.writeFile(sandboxId, layoutPath, patchRootLayout(layoutContent, locales));
        modifiedFiles.push(layoutPath);
        emit({ level: 'info', message: `Injected custom LanguageProvider into ${layoutPath}`, timestamp: new Date(), step: 'setup_lingo' });
      }

      emit({
        level: 'success',
        message: `Lingo.dev configured (${useFullRuntime ? 'full' : 'custom'} runtime) — ${modifiedFiles.length} files modified`,
        timestamp: new Date(),
        step: 'setup_lingo',
      });

      return { modifiedFiles, runtimeStrategy: useFullRuntime ? 'full' : 'custom' };
    },
  });
}
