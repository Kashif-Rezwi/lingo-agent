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

  const vercelHideCSS = `<style dangerouslySetInnerHTML={{ __html: \`
      [data-vercel-feedback], #vercel-live-feedback,
      body > div[style*="z-index: 2147483647"] { display: none !important; }
    \` }} />`;

  patched = patched.replace(
    /\{children\}/g,
    `<LanguageProvider defaultLocale="en" availableLocales={[${localeList}]}>\n        {children}\n        <TextTranslator />\n        <LanguageSwitcher />\n        ${vercelHideCSS}\n      </LanguageProvider>`,
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

/** Generates app/i18n/switcher.tsx — small FAB with translate icon + dropdown. */
export function generateLanguageSwitcher(): string {
  return `'use client';
import { useState, useEffect, useRef } from 'react';
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

const TranslateIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="m12.87 15.07-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7 1.62-4.33L19.12 17h-3.24z"/>
  </svg>
);

export function LanguageSwitcher() {
  const { locale, changeLocale, availableLocales } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!mounted || availableLocales.length <= 1) return null;

  return createPortal(
    <div ref={ref} style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999 }}>
      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', bottom: '56px', right: 0,
          background: 'rgba(255,255,255,0.98)', border: '1px solid #e2e8f0',
          borderRadius: '12px', padding: '6px', boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          backdropFilter: 'blur(16px)', minWidth: '160px',
          animation: 'lingoSlideUp 0.2s ease-out',
        }}>
          {availableLocales.map((loc) => (
            <button key={loc} onClick={() => { changeLocale(loc); setOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
              padding: '8px 12px', borderRadius: '8px', border: 'none',
              background: loc === locale ? '#0070f3' : 'transparent',
              color: loc === locale ? '#fff' : '#374151',
              cursor: 'pointer', fontSize: '14px', fontWeight: loc === locale ? 600 : 400,
              transition: 'background 0.15s, color 0.15s', whiteSpace: 'nowrap',
            }}
              onMouseEnter={(e) => { if (loc !== locale) e.currentTarget.style.background = '#f1f5f9'; }}
              onMouseLeave={(e) => { if (loc !== locale) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: '18px' }}>{LOCALE_FLAGS[loc] ?? '\u{1F310}'}</span>
              <span>{LOCALE_NAMES[loc] ?? loc.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
      {/* FAB Button */}
      <button onClick={() => setOpen(!open)} aria-label="Change language" style={{
        width: '48px', height: '48px', borderRadius: '50%', border: 'none',
        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
        color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'center', boxShadow: '0 4px 20px rgba(79,70,229,0.4)',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(79,70,229,0.5)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(79,70,229,0.4)'; }}
      >
        <TranslateIcon />
      </button>
      <style>{\`
        @keyframes lingoSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      \`}</style>
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
      if (nk && value) keyMap.set(nk, value);
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
