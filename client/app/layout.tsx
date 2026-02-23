import type { Metadata } from 'next';
import { SessionProvider } from '@/app/session-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'LingoAgent — Multilingual Support, Automated',
  description:
    'LingoAgent autonomously adds multilingual support to Next.js repositories — one PR, one preview, zero configuration.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased scrollbar-hide" style={{ backgroundColor: 'var(--bg-base)' }}>
        {/* Subtle global radial noise to break flatness */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 70%)',
          }}
        />
        <div className="relative z-10">
          <SessionProvider>{children}</SessionProvider>
        </div>
      </body>
    </html>
  );
}
