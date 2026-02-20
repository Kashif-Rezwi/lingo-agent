/** Pure framework detection logic based on Next.js/App/Pages router presence. */

export type Framework = 'nextjs-app-router' | 'nextjs-pages' | 'unknown';

export interface FrameworkDetectionResult {
  framework: Framework;
  /** Path to root layout file — only set for nextjs-app-router */
  layoutPath: string | null;
}

export function detectFramework(packageJsonDeps: Record<string, string>, filePaths: string[]): FrameworkDetectionResult {
  // packageJsonDeps is already a merged deps+devDeps object from the caller
  const hasNext = 'next' in packageJsonDeps;

  if (!hasNext) {
    return { framework: 'unknown', layoutPath: null };
  }

  // App Router: requires app/layout.tsx or app/layout.jsx at any depth
  const layoutPath = filePaths.find(
    (p) =>
      /\bapp\/layout\.(tsx|jsx|ts|js)$/.test(p) &&
      !p.includes('node_modules'),
  );

  if (layoutPath) {
    return { framework: 'nextjs-app-router', layoutPath };
  }

  // Pages Router: _app.tsx / _app.jsx inside pages/
  const hasPagesRouter = filePaths.some(
    (p) =>
      /\bpages\/_app\.(tsx|jsx|ts|js)$/.test(p) &&
      !p.includes('node_modules'),
  );

  if (hasPagesRouter) {
    return { framework: 'nextjs-pages', layoutPath: null };
  }

  // Has Next.js but unrecognisable structure
  return { framework: 'unknown', layoutPath: null };
}

/** Known i18n libraries that conflict with the Lingo.dev compiler. */
const CONFLICTING_I18N_LIBS = [
  'next-intl',
  'i18next',
  'react-i18next',
  'next-i18next',
  '@lingui/core',
  'rosetta',
  'typesafe-i18n',
];

/** Returns the name of the first conflicting i18n library found, or null. */
export function detectConflictingI18n(
  allDeps: Record<string, string>,
): string | null {
  for (const lib of CONFLICTING_I18N_LIBS) {
    if (lib in allDeps) return lib;
  }
  return null;
}
