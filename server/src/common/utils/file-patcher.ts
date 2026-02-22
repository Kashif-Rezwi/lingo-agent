/** Pure string-transform utilities for patching Next.js config files. */

// ---------------------------------------------------------------------------
// RUNTIME STRATEGY:
//   Full  (@lingo.dev/compiler) → Next.js 15+ and React 19+ → withLingo + LingoProvider
//   Custom (no external deps)   → Next.js 14  or React 18   → our LanguageProvider/Switcher
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// next.config patch — FULL runtime (Next.js 15+ / React 19)
// ---------------------------------------------------------------------------

/** Wraps next.config default export with withLingo() from @lingo.dev/compiler. */
export function patchNextConfigFull(content: string): string {
  if (content.includes('withLingo')) return content;

  let patched = content;
  const firstImportEnd = findAfterLastImport(patched);
  patched =
    patched.slice(0, firstImportEnd) +
    `import { withLingo } from '@lingo.dev/compiler';\n` +
    patched.slice(firstImportEnd);

  patched = patched.replace(
    /export\s+default\s+([^;]+);/,
    (_, expr) => `export default withLingo(${expr.trim()});`,
  );
  patched = patched.replace(
    /module\.exports\s*=\s*([^;]+);/,
    (_, expr) => `module.exports = withLingo(${expr.trim()});`,
  );
  return patched;
}

// ---------------------------------------------------------------------------
// next.config patch — CUSTOM runtime (React 18 fallback, no-op for next.config)
// ---------------------------------------------------------------------------

/** No-op: custom runtime doesn't need to modify next.config. */
export function patchNextConfig(content: string): string {
  return content;
}

// ---------------------------------------------------------------------------
// layout.tsx patch — FULL runtime (official LingoProvider from @lingo.dev/compiler)
// ---------------------------------------------------------------------------

/** Injects official LingoProvider (from @lingo.dev/react/client) into root layout. Requires React 19. */
export function patchRootLayoutFull(content: string, locales: string[]): string {
  if (content.includes('LingoProvider')) return content;

  let patched = content;
  const firstImportEnd = findAfterLastImport(patched);
  const localeList = ['en', ...locales].map((l) => `'${l}'`).join(', ');

  patched =
    patched.slice(0, firstImportEnd) +
    `import { LingoProvider } from '@lingo.dev/react/client';\n` +
    patched.slice(firstImportEnd);

  patched = patched.replace(
    /\{children\}/g,
    `<LingoProvider locales={[${localeList}]}>{children}</LingoProvider>`,
  );
  return patched;
}


// ---------------------------------------------------------------------------
// layout.tsx patch — injects our custom LanguageProvider (no external deps)
// ---------------------------------------------------------------------------

/** Injects LanguageProvider + LanguageSwitcher + TextTranslator into the root layout. */
export function patchRootLayout(content: string, locales: string[]): string {
  if (content.includes('LanguageProvider')) return content; // already patched

  let patched = content;
  const firstImportEnd = findAfterLastImport(patched);
  const localeList = ['en', ...locales].map((l) => `'${l}'`).join(', ');

  // Add imports right after existing imports
  const imports =
    `import { LanguageProvider } from './i18n/provider';\n` +
    `import { LanguageSwitcher } from './i18n/switcher';\n` +
    `import { TextTranslator } from './i18n/text-translator';\n`;

  patched = patched.slice(0, firstImportEnd) + imports + patched.slice(firstImportEnd);

  // Wrap {children} with <LanguageProvider> and add <LanguageSwitcher />
  patched = patched.replace(
    /\{children\}/g,
    `<LanguageProvider defaultLocale="en" availableLocales={[${localeList}]}>\n        {children}\n        <TextTranslator />\n        <LanguageSwitcher />\n      </LanguageProvider>`,
  );

  return patched;
}

// ---------------------------------------------------------------------------
// i18n provider file generator — self-contained React context, no external deps
// ---------------------------------------------------------------------------

/** Generates the content of app/i18n/provider.tsx */
export function generateI18nProvider(): string {
  return `'use client';
import React, { createContext, useContext, useState, useCallback } from 'react';

type Translations = Record<string, string>;

interface I18nContextType {
  locale: string;
  translations: Translations;
  t: (key: string, fallback?: string) => string;
  changeLocale: (locale: string) => Promise<void>;
  availableLocales: string[];
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  translations: {},
  t: (key, fallback) => fallback ?? key,
  changeLocale: async () => {},
  availableLocales: ['en'],
});

export function useI18n() {
  return useContext(I18nContext);
}

interface LanguageProviderProps {
  children: React.ReactNode;
  defaultLocale?: string;
  availableLocales: string[];
}

export function LanguageProvider({ children, defaultLocale = 'en', availableLocales }: LanguageProviderProps) {
  const [locale, setLocale] = useState(defaultLocale);
  const [translations, setTranslations] = useState<Translations>({});

  const changeLocale = useCallback(async (loc: string) => {
    if (loc === defaultLocale) {
      setTranslations({});
      setLocale(loc);
      return;
    }
    try {
      const res = await fetch(\`/locales/\${loc}.json\`);
      if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
      const data: Translations = await res.json();
      setTranslations(data);
      setLocale(loc);
    } catch (e) {
      console.warn(\`[i18n] Could not load locale "\${loc}":\`, e);
    }
  }, [defaultLocale]);

  const t = useCallback(
    (key: string, fallback?: string) => translations[key] ?? fallback ?? key,
    [translations],
  );

  return (
    <I18nContext.Provider value={{ locale, translations, t, changeLocale, availableLocales }}>
      {children}
    </I18nContext.Provider>
  );
}
`;
}

// ---------------------------------------------------------------------------
// Language switcher component generator
// ---------------------------------------------------------------------------

/** Generates the content of app/i18n/switcher.tsx */
export function generateLanguageSwitcher(): string {
  return `'use client';
import { useI18n } from './provider';

const LOCALE_FLAGS: Record<string, string> = {
  en: '🇺🇸', fr: '🇫🇷', ar: '🇸🇦', ja: '🇯🇵',
  de: '🇩🇪', es: '🇪🇸', it: '🇮🇹', pt: '🇧🇷', zh: '🇨🇳', ko: '🇰🇷',
};

const LOCALE_NAMES: Record<string, string> = {
  en: 'English', fr: 'Français', ar: 'العربية', ja: '日本語',
  de: 'Deutsch', es: 'Español', it: 'Italiano', pt: 'Português', zh: '中文', ko: '한국어',
};

export function LanguageSwitcher() {
  const { locale, changeLocale, availableLocales } = useI18n();
  if (availableLocales.length <= 1) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: '6px',
      background: 'rgba(255,255,255,0.97)', border: '1px solid #e2e8f0',
      borderRadius: '14px', padding: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      backdropFilter: 'blur(12px)',
    }}>
      <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>
        🌐 Language
      </p>
      {availableLocales.map((loc) => (
        <button key={loc} onClick={() => changeLocale(loc)} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '7px 14px', borderRadius: '8px', border: 'none',
          background: loc === locale ? '#0070f3' : 'transparent',
          color: loc === locale ? '#fff' : '#374151',
          cursor: 'pointer', fontSize: '13px', fontWeight: loc === locale ? 600 : 400,
          transition: 'all 0.15s', whiteSpace: 'nowrap',
        }}>
          <span>{LOCALE_FLAGS[loc] ?? '🌐'}</span>
          <span>{LOCALE_NAMES[loc] ?? loc.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
}
`;
}

// ---------------------------------------------------------------------------
// TextTranslator — DOM text-node replacement on locale change
// ---------------------------------------------------------------------------

/** Generates app/i18n/text-translator.tsx — replaces DOM text nodes with translations. */
export function generateTextTranslator(): string {
  return `'use client';
import { useEffect, useRef } from 'react';
import { useI18n } from './provider';

/** Normalise whitespace for consistent key lookup (handles multiline JSX strings). */
function normalize(s: string): string {
  return s.replace(/\\s+/g, ' ').trim();
}

/**
 * TextTranslator — invisible component, mounted in root layout.
 * On every locale change it: (1) restores all text nodes to their original
 * English values, then (2) replaces nodes whose normalised text matches a
 * translation key.  Always restoring first makes direct switching (FR→JA)
 * work correctly without going through English.
 */
export function TextTranslator() {
  const { translations, locale } = useI18n();
  const originalTexts = useRef<Map<Text, string>>(new Map());

  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Step 1 — always restore every known text node to its original English value.
    // This is what makes FR→JA work: we start from English, not from French.
    originalTexts.current.forEach((orig, node) => {
      if (document.body.contains(node)) node.textContent = orig;
    });

    // Step 2 — if switching back to English (empty translations) we are done.
    if (Object.keys(translations).length === 0) return;

    // Step 3 — walk DOM text nodes and record any we haven't seen yet.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const updates: Array<[Text, string]> = [];

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const raw = node.textContent ?? '';
      if (!raw.trim()) continue;

      // Snapshot original the first time we encounter this node.
      if (!originalTexts.current.has(node)) {
        originalTexts.current.set(node, raw);
      }

      // Normalise whitespace so multiline JSX strings match DOM collapsed text.
      const key = normalize(originalTexts.current.get(node)!);
      const translated = translations[key];
      if (translated && translated !== key) {
        updates.push([node, translated]);
      }
    }

    updates.forEach(([node, text]) => { node.textContent = text; });
  }, [translations, locale]);

  return null;
}
`;
}

// ---------------------------------------------------------------------------
// i18n.json generator
// ---------------------------------------------------------------------------

/** Generates the i18n.json configuration file for Lingo.dev. */
export function generateI18nConfig(sourceLocale: string, targetLocales: string[]): string {
  return JSON.stringify({ locale: { source: sourceLocale, targets: targetLocales } }, null, 2);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function findAfterLastImport(content: string): number {
  const importRegex = /^import\s+.+from\s+['"].+['"];?\s*$/gm;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    lastIndex = match.index + match[0].length;
  }

  return lastIndex === 0 ? 0 : lastIndex + 1;
}
