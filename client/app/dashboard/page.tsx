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
                // Navigate to dedicated job page — each job has its own shareable URL
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
            <main className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
            {/* Header */}
            <header className="border-b border-slate-800/60 py-4 px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-xl font-bold tracking-tight">
                        Lingo<span className="text-indigo-400">Agent</span>
                    </span>
                    <span className="text-xs text-slate-500 hidden sm:block">
                        Multilingual support, automated.
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    {session?.user?.image && (
                        <Image
                            src={session.user.image}
                            alt={session.user.name ?? 'User'}
                            width={28}
                            height={28}
                            className="rounded-full ring-2 ring-slate-700"
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

            {/* Main content */}
            <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Add multilingual support</h1>
                    <p className="text-slate-400 text-sm">
                        Paste your Next.js GitHub repository URL, pick target languages, and LingoAgent will
                        open a PR with full translation support — automatically.
                    </p>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
                    <RepoInputForm
                        onSubmit={handleSubmit}
                        isLoading={isLoading}
                        isStreaming={false}
                    />
                </div>

                {error && (
                    <div className="bg-red-950/40 border border-red-700/40 rounded-xl p-4">
                        <p className="text-red-400 text-sm font-medium">{error}</p>
                    </div>
                )}
            </div>
        </main>
    );
}
