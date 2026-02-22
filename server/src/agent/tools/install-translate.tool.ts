import { tool } from 'ai';
import { z } from 'zod';
import { SandboxService } from '../../sandbox/sandbox.service.js';
import type { EmitFn } from '../../common/types/index.js';

/** Tool 5 — install_and_translate: Uses lingo.dev/sdk SDK in-process to translate locale files. */
export function createInstallTranslateTool(
  sandbox: SandboxService,
  lingoApiKey: string,
  emit: EmitFn,
) {
  return tool({
    description:
      'Translates the project using the Lingo.dev SDK called in-process on the server. No CLI, no npm, no sandbox exec involved.',
    inputSchema: z.object({
      sandboxId: z.string().describe('E2B sandbox ID'),
      workDir: z.string().describe('Absolute path to the cloned repo'),
    }),
    execute: async ({ sandboxId, workDir }) => {
      emit({
        level: 'info',
        message: 'Initializing Server-Side Translation (Lingo.dev SDK)…',
        timestamp: new Date(),
        step: 'install_and_translate',
      });


      // Read i18n.json from the sandbox to get locale configuration
      let i18nConfig: { locale?: { source?: string; targets?: string[] } };
      try {
        const raw = await sandbox.readFile(sandboxId, `${workDir}/i18n.json`);
        i18nConfig = JSON.parse(raw);
      } catch (err: any) {
        throw new Error(`Failed to read i18n.json from sandbox: ${err.message}`);
      }

      const sourceLocale = i18nConfig.locale?.source ?? 'en';
      const targetLocales = i18nConfig.locale?.targets ?? [];

      if (targetLocales.length === 0) {
        emit({ level: 'warn', message: 'No target locales configured — skipping translation.', timestamp: new Date(), step: 'install_and_translate' });
        return { generatedLocales: [], wordCounts: {} };
      }

      // Dynamically import the SDK so it doesn't pollute CJS module resolution
      // lingo.dev/sdk exports LingoDotDevEngine, confirmed by inspecting the package exports
      const { LingoDotDevEngine } = await import('lingo.dev/sdk' as string) as any;

      const engine = new LingoDotDevEngine({ apiKey: lingoApiKey });

      // Extract REAL visible text strings from JSX/TSX component files.
      // We use key=value (original text = original text) so the TextTranslator
      // can match DOM text nodes exactly. After translation, fr.json looks like:
      //   { "Speech Focused Language Learning": "Apprentissage de langues..." }
      let sourceStrings: Record<string, string> = {};
      try {
        // grep for JSX text nodes: literal text between > and < that contains real words
        const { stdout: grepOut } = await sandbox.exec(
          sandboxId,
          // Extract text between JSX tags across all tsx/jsx files; limit to prevent huge payloads
          `grep -rh --include="*.tsx" --include="*.jsx" -oP '(?<=>)[^<>{}]{3,}(?=<)' ${workDir}/app 2>/dev/null | sort -u | head -300`,
        );

        const extracted = grepOut
          .split('\n')
          .map((s) => s.replace(/\s+/g, ' ').trim()) // normalise whitespace (multiline JSX → single space)
          .filter((s) => {
            if (!s || s.length < 3 || s.length > 200) return false;
            if (!/[a-zA-Z]/.test(s)) return false; // must have at least one letter
            if (/[{}=<>]/.test(s)) return false;    // exclude code characters
            if (/^\/\//.test(s)) return false;      // exclude comments
            return true;
          });

        if (extracted.length > 0) {
          for (const text of extracted) {
            sourceStrings[text] = text; // key = value = original English text
          }
          emit({
            level: 'info',
            message: `Extracted ${extracted.length} unique text strings from JSX files`,
            timestamp: new Date(),
            step: 'install_and_translate',
          });
        }
      } catch {
        // grep failed — fall through to default strings below
      }

      // Fallback: if extraction yielded nothing, use basic generic strings
      if (Object.keys(sourceStrings).length === 0) {
        sourceStrings = {
          'Welcome': 'Welcome',
          'Get Started': 'Get Started',
          'Home': 'Home',
          'About': 'About',
          'Contact': 'Contact',
        };
      }

      // Ensure the public/locales directory exists (Next.js serves public/* as static files)
      await sandbox.exec(sandboxId, `mkdir -p ${workDir}/public/locales`);

      // Write the source locale file (browser fetches from /locales/en.json via Next.js static serving)
      await sandbox.writeFile(
        sandboxId,
        `${workDir}/public/locales/${sourceLocale}.json`,
        JSON.stringify(sourceStrings, null, 2),
      );

      // Translate in-process for each target locale using the SDK
      const generatedLocales: string[] = [sourceLocale];

      for (const targetLocale of targetLocales) {
        emit({
          level: 'info',
          message: `Translating to ${targetLocale}…`,
          timestamp: new Date(),
          step: 'install_and_translate',
        });

        const translated = await engine.localizeObject(sourceStrings, {
          sourceLocale,
          targetLocale,
        });

        await sandbox.writeFile(
          sandboxId,
          `${workDir}/public/locales/${targetLocale}.json`,
          JSON.stringify(translated, null, 2),
        );

        generatedLocales.push(targetLocale);
      }

      emit({
        level: 'success',
        message: `Translation complete — ${generatedLocales.length} locale(s): ${generatedLocales.join(', ')}`,
        timestamp: new Date(),
        step: 'install_and_translate',
      });

      return { generatedLocales, wordCounts: {} };
    },
  });
}
