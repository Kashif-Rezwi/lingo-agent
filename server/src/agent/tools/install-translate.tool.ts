import { tool } from 'ai';
import { z } from 'zod';
import { SandboxService } from '../../sandbox/sandbox.service.js';
import { LingoDotDevEngine } from 'lingo.dev/sdk';
import type { EmitFn } from '../../common/types/index.js';

/**
 * Tool 5 — install_and_translate:
 *
 * 1. Runs `npm install` inside the E2B sandbox to create node_modules
 *    (required for Babel AST extraction which uses @babel/parser from Next.js)
 * 2. Writes a Babel AST extraction script that finds ALL hardcoded JSX strings
 * 3. Translates them via Lingo.dev SDK
 * 4. Writes public/locales/<locale>.json for runtime TextTranslator
 */
export function createInstallTranslateTool(
  sandbox: SandboxService,
  lingoApiKey: string,
  emit: EmitFn,
) {
  return tool({
    description:
      'Runs npm install, extracts ALL hardcoded JSX strings via Babel AST, translates them ' +
      'with Lingo.dev SDK, and writes public/locales/*.json files for runtime translation.',
    inputSchema: z.object({
      sandboxId: z.string().describe('E2B sandbox ID'),
      workDir: z.string().describe('Absolute path to the cloned repo'),
    }),
    execute: async ({ sandboxId, workDir }) => {
      // ── 0. Read i18n.json for locale config ──────────────────────────────
      let sourceLocale = 'en';
      let targetLocales: string[] = [];
      try {
        const raw = await sandbox.readFile(sandboxId, `${workDir}/i18n.json`);
        const cfg = JSON.parse(raw);
        sourceLocale = cfg.locale?.source ?? 'en';
        targetLocales = cfg.locale?.targets ?? [];
      } catch (err: any) {
        throw new Error(`i18n.json missing or invalid: ${err.message}`);
      }
      if (targetLocales.length === 0) throw new Error('No target locales in i18n.json');

      // ── 1. Run npm install to get node_modules (needed for Babel) ─────────
      emit({
        level: 'info',
        message: 'Installing dependencies (npm install)…',
        timestamp: new Date(),
        step: 'install_and_translate',
      });
      try {
        await sandbox.exec(sandboxId, `cd ${workDir} && npm install --legacy-peer-deps 2>&1 | tail -5`);
        emit({
          level: 'info',
          message: 'npm install completed',
          timestamp: new Date(),
          step: 'install_and_translate',
        });
      } catch (err: any) {
        emit({
          level: 'info',
          message: `npm install failed (${err.message}) — will use grep fallback`,
          timestamp: new Date(),
          step: 'install_and_translate',
        });
      }

      // ── 2. Write Babel AST extraction script ─────────────────────────────
      emit({
        level: 'info',
        message: 'Extracting text strings via Babel AST…',
        timestamp: new Date(),
        step: 'install_and_translate',
      });

      const extractScript = `
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const repoRoot = process.argv[2];
const nmDir = join(repoRoot, 'node_modules');

// Dynamically load Babel from the repo's node_modules
let parse, traverse;
try {
  const parserMod = await import(join(nmDir, '@babel/parser', 'lib', 'index.js'));
  parse = parserMod.parse ?? parserMod.default?.parse;
} catch (e) {
  console.error('BABEL_PARSE_FAIL:', e.message);
  process.exit(1);
}
try {
  const travMod = await import(join(nmDir, '@babel/traverse', 'lib', 'index.js'));
  traverse = travMod.default?.default ?? travMod.default ?? travMod;
} catch {
  try {
    const travMod = await import(join(nmDir, '@babel/traverse'));
    traverse = travMod.default?.default ?? travMod.default ?? travMod;
  } catch (e) {
    console.error('BABEL_TRAVERSE_FAIL:', e.message);
    process.exit(1);
  }
}

function isTranslatable(s, ctx) {
  s = s.trim();
  if (!s || s.length < 2 || s.length > 500) return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  if (/^[{}=<>\\\\/]/.test(s)) return false;
  if (/^(import|export|const|let|var|function|return|class|type|interface|from|if|else|switch|case)\\b/.test(s)) return false;
  if (/[{}();=]/.test(s)) return false;
  if (s.startsWith('//') || s.startsWith('/*') || s.startsWith('#')) return false;
  if (/^https?:\\/\\//.test(s)) return false;
  // Single-word identifier filter — context-aware
  const isJSX = ctx && ctx.isJSX;
  if (/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(s)) {
    if (/^[a-z]+[A-Z]/.test(s)) return false; // camelCase
    if (/^[A-Z_]{2,}$/.test(s) && s.length < 10) return false; // CONSTANT
    if (isJSX) return s.length >= 2; // Allow single-word JSX text like "Pricing"
    if (s.length < 20) return false;
  }
  // Reject CSS selector-like single tokens
  if (/^[a-z]+(-[a-z0-9]+)+$/.test(s)) return false;
  return true;
}

function walk(dir, exts, ignores, results) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    if (ignores.includes(e)) continue;
    const fp = join(dir, e);
    let stat;
    try { stat = statSync(fp); } catch { continue; }
    if (stat.isDirectory()) walk(fp, exts, ignores, results);
    else if (exts.includes(extname(fp))) results.push(fp);
  }
}

const IGNORES = ['node_modules', '.next', '.git', 'dist', 'out', 'i18n', '.cache', 'coverage', '__tests__'];
const files = [];
walk(repoRoot, ['.tsx', '.jsx'], IGNORES, files);

const strings = new Set();
const STRING_ATTRS = ['placeholder', 'title', 'alt', 'aria-label', 'label', 'aria-placeholder', 'aria-description', 'content'];
const SKIP_ATTRS = ['className', 'class', 'style', 'href', 'src', 'id', 'key', 'htmlFor', 'type', 'name', 'value', 'action', 'method', 'role', 'rel', 'target', 'ref', 'as', 'sizes', 'media', 'crossOrigin', 'loading', 'decoding', 'fetchPriority', 'viewBox', 'fill', 'stroke', 'd', 'xmlns'];

for (const file of files) {
  let code;
  try { code = readFileSync(file, 'utf8'); } catch { continue; }
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
      errorRecovery: true,
    });
  } catch { continue; }

  try {
    traverse(ast, {
      JSXText(path) {
        const text = path.node.value.replace(/\\\\s+/g, ' ').trim();
        if (isTranslatable(text, { isJSX: true })) strings.add(text);
      },
      StringLiteral(nodePath) {
        const val = nodePath.node.value.trim();
        const parent = nodePath.parent;
        // Skip non-translatable JSX attributes (className, style, href, src, etc.)
        if (parent.type === 'JSXAttribute') {
          const name = parent.name?.name;
          if (typeof name === 'string') {
            if (SKIP_ATTRS.includes(name) || name.startsWith('data-') || name.startsWith('on')) return;
          }
        }
        const isJSX = parent.type === 'JSXAttribute' || parent.type === 'JSXExpressionContainer';
        if (!isTranslatable(val, { isJSX })) return;
        // Translatable string attributes like placeholder="Enter your email"
        if (parent.type === 'JSXAttribute') {
          const name = parent.name?.name;
          if (typeof name === 'string' && STRING_ATTRS.includes(name)) {
            strings.add(val);
          }
        }
        // JSX expression containers like {"Build landing pages"}
        if (parent.type === 'JSXExpressionContainer') {
          strings.add(val);
        }
        // Variable/property declarations with user-facing strings
        if ((parent.type === 'VariableDeclarator' || parent.type === 'Property' || parent.type === 'ObjectProperty') && val.length > 5 && val.includes(' ')) {
          strings.add(val);
        }
        // Array elements with string content
        if (parent.type === 'ArrayExpression' && val.length > 5 && val.includes(' ')) {
          strings.add(val);
        }
      },
      TemplateLiteral(nodePath) {
        if (nodePath.node.expressions.length === 0 && nodePath.node.quasis.length === 1) {
          const val = nodePath.node.quasis[0].value.cooked?.replace(/\\s+/g, ' ').trim();
          if (val && isTranslatable(val, { isJSX: nodePath.parent.type === 'JSXExpressionContainer' })) strings.add(val);
        }
      },
    });
  } catch {}
}

console.log('EXTRACTED_COUNT:' + strings.size);
console.log('EXTRACTED_JSON:' + JSON.stringify([...strings]));
`;

      await sandbox.writeFile(sandboxId, `${workDir}/__extract.mjs`, extractScript);

      // ── 3. Run the Babel extraction script ─────────────────────────────────
      let extracted: string[] = [];
      try {
        const { stdout } = await sandbox.exec(
          sandboxId,
          `cd ${workDir} && node --experimental-vm-modules __extract.mjs ${workDir} 2>&1`,
        );

        // Parse the JSON output from the script
        const jsonLine = stdout.split('\n').find((l: string) => l.startsWith('EXTRACTED_JSON:'));
        if (jsonLine) {
          extracted = JSON.parse(jsonLine.replace('EXTRACTED_JSON:', ''));
        }
        const countLine = stdout.split('\n').find((l: string) => l.startsWith('EXTRACTED_COUNT:'));
        const count = countLine ? countLine.replace('EXTRACTED_COUNT:', '') : '0';

        emit({
          level: 'info',
          message: `Babel AST extracted ${count} strings from JSX files`,
          timestamp: new Date(),
          step: 'install_and_translate',
        });

        // Log first few extracted strings for debugging
        if (extracted.length > 0) {
          const samples = extracted.slice(0, 5).map(s => s.substring(0, 60));
          emit({
            level: 'info',
            message: `Sample strings: ${JSON.stringify(samples)}`,
            timestamp: new Date(),
            step: 'install_and_translate',
          });
        }
      } catch (err: any) {
        emit({
          level: 'info',
          message: `Babel extraction error: ${err.message}`,
          timestamp: new Date(),
          step: 'install_and_translate',
        });
      }

      // ── 4. Fallback to comprehensive grep if Babel failed ──────────────────
      if (extracted.length === 0) {
        emit({
          level: 'info',
          message: 'Babel extraction returned 0 strings — using grep fallback',
          timestamp: new Date(),
          step: 'install_and_translate',
        });

        const grepOpts = `--include="*.tsx" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=i18n --exclude-dir=.git`;

        // Pass 1: JSX text between tags (multi-word, meaningful text)
        const { stdout: p1 } = await sandbox.exec(
          sandboxId,
          `grep -rhoP '(?<=>)[^<>{}]{3,}(?=<)' ${grepOpts} ${workDir} 2>/dev/null | sort -u | head -500`,
        );

        // Pass 2: String attributes
        const { stdout: p2 } = await sandbox.exec(
          sandboxId,
          `grep -rhoP '(?:placeholder|title|alt|aria-label|label|content)="\\K[^"]{3,}' ${grepOpts} ${workDir} 2>/dev/null | sort -u | head -200`,
        );

        // Pass 3: JSX string expressions {"text here"}
        const { stdout: p3 } = await sandbox.exec(
          sandboxId,
          `grep -rhoP '(?<={")[^"]{3,}(?="})' ${grepOpts} ${workDir} 2>/dev/null | sort -u | head -200`,
        );

        // Pass 4: String variables with user-facing text patterns
        const { stdout: p4 } = await sandbox.exec(
          sandboxId,
          `grep -rhoP "'[A-Z][^']{5,}'" ${grepOpts} ${workDir} 2>/dev/null | sed "s/^'//;s/'$//" | sort -u | head -200`,
        );
        const { stdout: p5 } = await sandbox.exec(
          sandboxId,
          `grep -rhoP '"[A-Z][^"]{5,}"' ${grepOpts} ${workDir} 2>/dev/null | sed 's/^"//;s/"$//' | sort -u | head -200`,
        );

        const allRaw = [p1, p2, p3, p4, p5].join('\n');
        extracted = [...new Set(
          allRaw.split('\n')
            .map(s => s.replace(/\s+/g, ' ').trim())
            .filter(s => {
              if (!s || s.length < 2 || s.length > 500) return false;
              if (!/[a-zA-Z]/.test(s)) return false;
              if (/^[{}=<>\\/*]/.test(s)) return false;
              if (/^(import|export|const|let|var|function|return|class|interface|type|from)\b/.test(s)) return false;
              if (/^\/\//.test(s)) return false;
              if (/^[a-z]+\(/.test(s)) return false;
              if (/[{}()=>;]/.test(s)) return false;
              if (/^https?:\/\//.test(s)) return false;
              return true;
            }),
        )];

        emit({
          level: 'info',
          message: `Grep fallback extracted ${extracted.length} strings`,
          timestamp: new Date(),
          step: 'install_and_translate',
        });
      }

      // Deduplicate
      extracted = [...new Set(extracted)].filter(s => s.length > 1 && s.length < 500);

      if (extracted.length === 0) {
        emit({ level: 'info', message: 'No translatable strings found', timestamp: new Date(), step: 'install_and_translate' });
        return { generatedLocales: [sourceLocale, ...targetLocales], wordCounts: {} };
      }

      // ── 5. Reset sandbox timer — extraction consumed significant time ─────
      try { await sandbox.keepAlive(sandboxId); } catch { }

      // ── 6. Translate via Lingo.dev SDK ─────────────────────────────────────
      const sourceObj: Record<string, string> = {};
      for (const s of extracted) sourceObj[s] = s;

      const lingo = new LingoDotDevEngine({ apiKey: lingoApiKey });
      const generatedLocales: string[] = [sourceLocale];
      const wordCounts: Record<string, number> = {};

      await sandbox.exec(sandboxId, `mkdir -p ${workDir}/public/locales`);
      await sandbox.writeFile(sandboxId, `${workDir}/public/locales/${sourceLocale}.json`, JSON.stringify(sourceObj, null, 2));

      for (const locale of targetLocales) {
        emit({ level: 'info', message: `Translating ${extracted.length} strings to ${locale}…`, timestamp: new Date(), step: 'install_and_translate' });
        try {
          const translated: Record<string, string> = {};
          const keys = Object.keys(sourceObj);
          const chunkSize = 50;

          for (let i = 0; i < keys.length; i += chunkSize) {
            const chunk = keys.slice(i, i + chunkSize);
            const chunkObj: Record<string, string> = {};
            for (const k of chunk) chunkObj[k] = sourceObj[k];
            const result = await lingo.localizeObject(chunkObj, { sourceLocale, targetLocale: locale });
            Object.assign(translated, result);
          }

          await sandbox.writeFile(sandboxId, `${workDir}/public/locales/${locale}.json`, JSON.stringify(translated, null, 2));
          const wc = Object.values(translated).join(' ').split(/\s+/).length;
          wordCounts[locale] = wc;
          generatedLocales.push(locale);

          emit({
            level: 'info',
            message: `✓ ${locale}: ${Object.keys(translated).length} strings (${wc} words)`,
            timestamp: new Date(),
            step: 'install_and_translate',
          });
        } catch (err: any) {
          emit({ level: 'error', message: `Failed to translate ${locale}: ${err.message}`, timestamp: new Date(), step: 'install_and_translate' });
        }

        // Reset sandbox clock after each locale — prevents timeout during multi-locale translation
        try { await sandbox.keepAlive(sandboxId); } catch { }
      }

      // Clean up extraction script
      await sandbox.exec(sandboxId, `rm -f ${workDir}/__extract.mjs`);

      emit({
        level: 'success',
        message: `Translation complete: ${extracted.length} strings × ${targetLocales.length} locales (${Object.values(wordCounts).reduce((a, b) => a + b, 0)} total words)`,
        timestamp: new Date(),
        step: 'install_and_translate',
      });

      return { generatedLocales, wordCounts };
    },
  });
}
