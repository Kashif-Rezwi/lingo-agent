'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { startJob } from '@/lib/api-client';
import { RepoInputForm } from '@/components/repo-input-form';

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'unauthenticated') router.replace('/login');
    }, [status, router]);

    const githubToken = (session as typeof session & { githubToken?: string })?.githubToken ?? '';

    const handleSubmit = useCallback(
        async (repoUrl: string, locales: string[]) => {
            setError(null);
            setIsLoading(true);
            try {
                const { jobId } = await startJob({ repoUrl, locales, githubToken });
                router.push(`/jobs/${jobId}`);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to start job.');
            } finally {
                setIsLoading(false);
            }
        },
        [githubToken, router],
    );

    if (status === 'loading') {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="animate-spin-slow rounded-full h-8 w-8 border-2 border-indigo-500/30 border-t-indigo-400" />
            </main>
        );
    }

    return (
        <main className="min-h-screen">
            {/* Header */}
            <header className="border-b border-white/5 py-4 px-6 flex items-center justify-between glass sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <span className="text-lg font-bold tracking-tight text-white">
                        Lingo<span className="text-indigo-400">Agent</span>
                    </span>
                    <span className="hidden sm:block text-[11px] text-slate-500 bg-slate-800/60 border border-slate-700/50 px-2 py-0.5 rounded-full">
                        Next.js App Router
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    {session?.user?.image && (
                        <Image
                            src={session.user.image}
                            alt={session.user.name ?? 'User'}
                            width={28}
                            height={28}
                            className="rounded-full ring-2 ring-indigo-500/30"
                        />
                    )}
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        Sign out
                    </button>
                </div>
            </header>

            {/* Main */}
            <div className="max-w-2xl mx-auto px-6 py-14 space-y-8 animate-fade-up">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                        Add multilingual support
                    </h1>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Paste a Next.js GitHub repo URL, pick target languages, and LingoAgent opens a PR
                        with full i18n support — automatically.
                    </p>
                </div>

                {/* Form card */}
                <div className="glass rounded-2xl p-6 glow-indigo">
                    <RepoInputForm
                        onSubmit={handleSubmit}
                        isLoading={isLoading}
                        isStreaming={false}
                    />
                </div>

                {/* Error */}
                {error && (
                    <div className="animate-fade-in glass border border-red-500/20 rounded-xl p-4">
                        <p className="text-red-400 text-sm font-medium">{error}</p>
                    </div>
                )}

                {/* Tip */}
                <p className="text-center text-slate-600 text-xs">
                    ✦ Supports Next.js App Router repositories · Private repos require{' '}
                    <code className="text-slate-500">repo</code> scope
                </p>
            </div>
        </main>
    );
}
