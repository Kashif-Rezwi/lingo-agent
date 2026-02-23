/** Pure string-transform utilities for patching Next.js config files and generating i18n runtime files. */

// ---------------------------------------------------------------------------
// next.config patch — uses @lingo.dev/compiler withLingo wrapper at build time
// ---------------------------------------------------------------------------

/** Wraps next.config default export with withLingo() so the compiler runs at Vercel build time. */
export function patchNextConfigFull(content: string): string {
  if (content.includes('withLingo')) return content;

  let patched = content;
  const firstImportEnd = findAfterLastImport(patched);
  patched =
    patched.slice(0, firstImportEnd) +
    `import { withLingo } from '@lingo.dev/compiler';\n` +
    patched.slice(firstImportEnd);

  // Handle both ESM and CJS exports
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

/** No-op: custom runtime does not modify next.config. */
export function patchNextConfig(content: string): string {
  return content;
}

// ---------------------------------------------------------------------------
// layout.tsx patch — injects LingoProvider from @lingo.dev/compiler/react
// ---------------------------------------------------------------------------

/**
 * Injects LingoProvider (from @lingo.dev/compiler/react) + LanguageSwitcher into root layout.
 * @lingo.dev/compiler is the ONLY npm dep required — LingoProvider is a subpath export of it.
 */
export function patchRootLayoutFull(content: string, locales: string[]): string {
  if (content.includes('LingoProvider')) return content;

  let patched = content;
  const firstImportEnd = findAfterLastImport(patched);
  const localeList = ['en', ...locales].map((l) => `'${l}'`).join(', ');

  patched =
    patched.slice(0, firstImportEnd) +
    `import { LingoProvider } from '@lingo.dev/compiler/react';\n` +
    `import { LanguageSwitcher } from './i18n/switcher';\n` +
    patched.slice(firstImportEnd);

  patched = patched.replace(
    /\{children\}/g,
    `<LingoProvider locales={[${localeList}]}>{children}<LanguageSwitcher /></LingoProvider>`,
  );
  return patched;
}

// ---------------------------------------------------------------------------
// layout.tsx patch — custom runtime (fallback, no external deps)
// ---------------------------------------------------------------------------

/** Injects custom LanguageProvider + LanguageSwitcher + TextTranslator into root layout. */
export function patchRootLayout(content: string, locales: string[]): string {
  if (content.includes('LanguageProvider')) return content;

  let patched = content;
  const firstImportEnd = findAfterLastImport(patched);
  const localeList = ['en', ...locales].map((l) => `'${l}'`).join(', ');

  const imports =
    `import { LanguageProvider } from './i18n/provider';\n` +
    `import { LanguageSwitcher } from './i18n/switcher';\n` +
    `import { TextTranslator } from './i18n/text-translator';\n`;

  patched = patched.slice(0, firstImportEnd) + imports + patched.slice(firstImportEnd);

  patched = patched.replace(
    /\{children\}/g,
    `<LanguageProvider defaultLocale="en" availableLocales={[${localeList}]}>\n        {children}\n        <TextTranslator />\n        <LanguageSwitcher />\n      </LanguageProvider>`,
  );
  return patched;
}

// ---------------------------------------------------------------------------
// Shared helper: find insertion point after last import statement
// ---------------------------------------------------------------------------

function findAfterLastImport(content: string): number {
  const lines = content.split('\n');
  let lastImportLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) lastImportLine = i;
  }
  if (lastImportLine === -1) return 0;
  let pos = 0;
  for (let i = 0; i <= lastImportLine; i++) pos += lines[i].length + 1;
  return pos;
}

// ---------------------------------------------------------------------------
// i18n JSON config generator
// ---------------------------------------------------------------------------

/** Generates the i18n.json content for a project. */
export function generateI18nConfig(sourceLocale: string, targetLocales: string[]): string {
  return JSON.stringify(
    { locale: { source: sourceLocale, targets: targetLocales } },
    null,
    2,
  );
}

// ---------------------------------------------------------------------------
// Language switcher — portal-rendered to guarantee fixed positioning
// ---------------------------------------------------------------------------

/** Generates app/i18n/switcher.tsx — renders via createPortal into document.body. */
export function generateLanguageSwitcher(): string {
  return `'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from './provider';

const LOCALE_FLAGS: Record<string, string> = {
  en: '\u{1F1FA}\u{1F1F8}', fr: '\u{1F1EB}\u{1F1F7}', ar: '\u{1F1F8}\u{1F1E6}', ja: '\u{1F1EF}\u{1F1F5}',
  de: '\u{1F1E9}\u{1F1EA}', es: '\u{1F1EA}\u{1F1F8}', it: '\u{1F1EE}\u{1F1F9}', pt: '\u{1F1E7}\u{1F1F7}', zh: '\u{1F1E8}\u{1F1F3}', ko: '\u{1F1F0}\u{1F1F7}',
};

const LOCALE_NAMES: Record<string, string> = {
  en: 'English', fr: 'Fran\u{E7}ais', ar: '\u{627}\u{644}\u{639}\u{631}\u{628}\u{64A}\u{629}', ja: '\u{65E5}\u{672C}\u{8A9E}',
  de: 'Deutsch', es: 'Espa\u{F1}ol', it: 'Italiano', pt: 'Portugu\u{EA}s', zh: '\u{4E2D}\u{6587}', ko: '\u{D55C}\u{AD6D}\u{C5B4}',
};

export function LanguageSwitcher() {
  const { locale, changeLocale, availableLocales } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || availableLocales.length <= 1) return null;

  return createPortal(
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: '6px',
      background: 'rgba(255,255,255,0.97)', border: '1px solid #e2e8f0',
      borderRadius: '14px', padding: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      backdropFilter: 'blur(12px)',
    }}>
      <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>
        \u{1F310} Language
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
          <span>{LOCALE_FLAGS[loc] ?? '\u{1F310}'}</span>
          <span>{LOCALE_NAMES[loc] ?? loc.toUpperCase()}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
`;
}

// ---------------------------------------------------------------------------
// Custom runtime generators (kept for fallback / reference)
// ---------------------------------------------------------------------------

/** Generates app/i18n/provider.tsx — self-contained React context, no external deps. */
export function generateI18nProvider(): string {
  return `'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface I18nContextValue {
  locale: string;
  translations: Record<string, string>;
  changeLocale: (locale: string) => void;
  availableLocales: string[];
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en', translations: {}, changeLocale: () => {}, availableLocales: ['en'],
});

export const useI18n = () => useContext(I18nContext);

interface LanguageProviderProps {
  children: ReactNode;
  defaultLocale?: string;
  availableLocales?: string[];
}

export function LanguageProvider({ children, defaultLocale = 'en', availableLocales = ['en'] }: LanguageProviderProps) {
  const [locale, setLocale] = useState(defaultLocale);
  const [translations, setTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    if (locale === defaultLocale) { setTranslations({}); return; }
    fetch(\`/locales/\${locale}.json\`).then((r) => r.ok ? r.json() : {}).then(setTranslations).catch(() => setTranslations({}));
  }, [locale, defaultLocale]);

  return (
    <I18nContext.Provider value={{ locale, translations, changeLocale: setLocale, availableLocales }}>
      {children}
    </I18nContext.Provider>
  );
}
`;
}

/** Generates app/i18n/text-translator.tsx — DOM text-node + attribute replacement on locale change. */
export function generateTextTranslator(): string {
  return `'use client';
import { useEffect, useRef } from 'react';
import { useI18n } from './provider';

function normalize(s: string): string { return s.replace(/\\\\s+/g, ' ').trim(); }

const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'alt', 'aria-label', 'aria-placeholder'];
const ATTR_SELECTOR = TRANSLATABLE_ATTRS.map(a => '[' + a + ']').join(',');

export function TextTranslator() {
  const { translations, locale } = useI18n();
  const originalTexts = useRef<Map<Text, string>>(new Map());
  const originalAttrs = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Restore original text nodes
    originalTexts.current.forEach((orig, node) => { if (document.body.contains(node)) node.textContent = orig; });

    // Restore original attributes
    originalAttrs.current.forEach((orig, key) => {
      const [xpath, attr] = key.split('::');
      const el = document.querySelector(xpath);
      if (el) el.setAttribute(attr, orig);
    });

    if (Object.keys(translations).length === 0) return;

    const keyMap = new Map<string, string>();
    for (const [key, value] of Object.entries(translations)) {
      const nk = normalize(key);
      if (nk && value && nk !== value) keyMap.set(nk, value);
    }
    if (keyMap.size === 0) return;

    // ─── Pass 1: Text nodes ────────────────────────────────────────────
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const updates: Array<[Text, string]> = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const raw = node.textContent ?? '';
      if (!raw.trim()) continue;
      if (!originalTexts.current.has(node)) originalTexts.current.set(node, raw);
      const original = originalTexts.current.get(node)!;
      const normalised = normalize(original);
      if (keyMap.has(normalised)) { updates.push([node, keyMap.get(normalised)!]); continue; }
      let replaced = original; let didReplace = false;
      for (const [key, translated] of [...keyMap.entries()].sort((a, b) => b[0].length - a[0].length)) {
        if (key.length < 3) continue;
        if (replaced.includes(key)) { replaced = replaced.split(key).join(translated); didReplace = true; }
      }
      if (didReplace) updates.push([node, replaced]);
    }
    updates.forEach(([n, text]) => { n.textContent = text; });

    // ─── Pass 2: Element attributes ────────────────────────────────────
    const elements = document.body.querySelectorAll(ATTR_SELECTOR);
    elements.forEach((el, idx) => {
      TRANSLATABLE_ATTRS.forEach(attr => {
        const val = el.getAttribute(attr);
        if (!val) return;
        const norm = normalize(val);
        const storeKey = \`[data-lingo-idx="\${idx}"]||\${attr}\`;
        if (!originalAttrs.current.has(storeKey)) {
          el.setAttribute('data-lingo-idx', String(idx));
          originalAttrs.current.set(storeKey, val);
        }
        if (keyMap.has(norm)) {
          el.setAttribute(attr, keyMap.get(norm)!);
        }
      });
    });
  }, [translations, locale]);

  return null;
}
`;
}
