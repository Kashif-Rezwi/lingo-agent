import type { Metadata } from 'next';
import { SessionProvider } from '@/app/session-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'LingoAgent — Multilingual Support, Automated',
  description:
    'LingoAgent autonomously adds international support to Next.js repositories — one PR, one preview, zero configuration.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
