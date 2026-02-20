'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

/** Client component wrapper for NextAuth SessionProvider (required for App Router). */
export function SessionProvider({ children }: { children: React.ReactNode }) {
    return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
