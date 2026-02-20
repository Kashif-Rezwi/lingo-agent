/** Pure string-transform utilities for patching Next.js config files (next.config, app/layout). */

// ---------------------------------------------------------------------------
// next.config patch
// ---------------------------------------------------------------------------

const LINGO_CONFIG_IMPORT = `import { withLingo } from '@lingo.dev/compiler';\n`;

/** Wraps the default export in next.config.ts/js with `withLingo(...)`. Handles object/function exports. */
export function patchNextConfig(content: string): string {
  // Skip if already patched
  if (content.includes('withLingo')) return content;

  let patched = content;

  // Add import at the top (after any existing imports)
  const firstImportEnd = findAfterLastImport(patched);
  patched =
    patched.slice(0, firstImportEnd) +
    LINGO_CONFIG_IMPORT +
    patched.slice(firstImportEnd);

  // Wrap: export default <expr>
  patched = patched.replace(
    /export\s+default\s+([^;]+);/,
    (_, expr) => `export default withLingo(${expr.trim()});`,
  );

  // Wrap: module.exports = <expr>
  patched = patched.replace(
    /module\.exports\s*=\s*([^;]+);/,
    (_, expr) => `module.exports = withLingo(${expr.trim()});`,
  );

  return patched;
}

// ---------------------------------------------------------------------------
// layout.tsx patch
// ---------------------------------------------------------------------------

const LINGO_PROVIDER_IMPORT = `import { LingoProvider } from '@lingo.dev/react/client';\n`;

/** Injects `<LingoProvider>` as a wrapper around `{children}` in the root layout. */
export function patchRootLayout(content: string, locales: string[]): string {
  // Skip if already patched
  if (content.includes('LingoProvider')) return content;

  let patched = content;

  // Add import after the last existing import line
  const firstImportEnd = findAfterLastImport(patched);
  patched =
    patched.slice(0, firstImportEnd) +
    LINGO_PROVIDER_IMPORT +
    patched.slice(firstImportEnd);

  // Wrap {children} with <LingoProvider>
  const localeList = locales.map((l) => `'${l}'`).join(', ');
  patched = patched.replace(
    /\{children\}/g,
    `<LingoProvider locales={[${localeList}]}>{children}</LingoProvider>`,
  );

  return patched;
}

// ---------------------------------------------------------------------------
// i18n.json generator
// ---------------------------------------------------------------------------

/** Generates the i18n.json configuration file Lingo.dev needs. */
export function generateI18nConfig(
  sourceLocale: string,
  targetLocales: string[],
): string {
  const config = {
    locale: {
      source: sourceLocale,
      targets: targetLocales,
    },
  };
  return JSON.stringify(config, null, 2);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns string index after last import, used to insert new imports correctly. */
function findAfterLastImport(content: string): number {
  // Match ES import statements
  const importRegex = /^import\s+.+from\s+['"].+['"];?\s*$/gm;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    lastIndex = match.index + match[0].length;
  }

  // If no imports found, insert at the very top
  return lastIndex === 0 ? 0 : lastIndex + 1;
}
