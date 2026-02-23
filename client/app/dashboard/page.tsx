'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { startJob } from '@/lib/api-client';
import { RepoInputForm } from '@/components/repo-input-form';
import { JobHistoryTab } from '@/components/job-history-tab';
import { useJobHistory } from '@/hooks/use-job-history';

type Tab = 'new' | 'history';

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>('new');
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const { history, addJob, clearHistory } = useJobHistory();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('t') === 'history') {
                setTab('history');
            }
        }
    }, []);

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

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
                addJob({ jobId, repoUrl, locales, startedAt: new Date().toISOString(), status: 'running' });
                router.push(`/jobs/${jobId}`);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to start job.');
            } finally {
                setIsLoading(false);
            }
        },
        [githubToken, router, addJob],
    );

    if (status === 'loading') {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="animate-spin-slow rounded-full h-8 w-8 border-2 border-indigo-500/30 border-t-indigo-400" />
            </main>
        );
    }

    const doneCount = history.filter((j) => j.status === 'done').length;

    return (
        <main className="min-h-screen">
            {/* Header */}
            <header className="border-b border-white/5 py-4 px-6 flex items-center justify-between glass fixed top-0 w-full z-50 left-0">
                <div className="flex items-center gap-3">
                    <span className="text-lg font-bold tracking-tight text-white">
                        Lingo<span className="text-indigo-400">Agent</span>
                    </span>
                    {/* Multilingual agent badge */}
                    <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-indigo-400/80 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="m12.87 15.07-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7 1.62-4.33L19.12 17h-3.24z" />
                        </svg>
                        Multilingual AI Agent
                    </span>
                </div>
                {/* Profile menu */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setMenuOpen((o) => !o)}
                        className="flex items-center gap-2 group"
                        aria-label="Account menu"
                    >
                        {session?.user?.image && (
                            <Image
                                src={session.user.image}
                                alt={session.user.name ?? 'User'}
                                width={28}
                                height={28}
                                className="rounded-full ring-2 ring-indigo-400/50"
                            />
                        )}
                        <svg className="w-5 h-5 text-slate-500 group-hover:text-slate-300 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                        </svg>
                    </button>

                    {menuOpen && (
                        <div className="absolute right-0 mt-2 w-56 z-20 bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in shadow-black/80">
                            {session?.user && (
                                <div className="px-5 py-4 border-b border-white/5">
                                    <p className="text-sm font-semibold text-white truncate">{session.user.name}</p>
                                    <p className="text-xs text-slate-400 truncate mt-0.5">{session.user.email}</p>
                                </div>
                            )}
                            <div className="p-1.5">
                                <button
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                        <polyline points="16 17 21 12 16 7" />
                                        <line x1="21" y1="12" x2="9" y2="12" />
                                    </svg>
                                    Sign out
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Main */}
            <div className="max-w-2xl mx-auto px-6 pt-24 pb-6 space-y-6 animate-fade-up">

                {/* Title */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                        Go Multilingual, in minutes.
                    </h1>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Drop a Next.js repo URL, pick your languages, and LingoAgent ships a
                        production-ready multilingual PR in seconds — zero config, zero friction.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 border-b border-white/5 pb-0">
                    <TabButton active={tab === 'new'} onClick={() => setTab('new')}>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                        New Job
                    </TabButton>
                    <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
                        </svg>
                        History
                        {history.length > 0 && (
                            <span className="ml-1 text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full px-1.5 py-0 leading-4">
                                {history.length}
                            </span>
                        )}
                    </TabButton>
                </div>

                {/* Tab: New Job */}
                {tab === 'new' && (
                    <div className="space-y-4">
                        <div className="glass rounded-2xl p-6 glow-indigo">
                            <RepoInputForm
                                onSubmit={handleSubmit}
                                isLoading={isLoading}
                                isStreaming={false}
                            />
                        </div>
                        {error && (
                            <div className="animate-fade-in glass border border-red-500/20 rounded-xl p-4">
                                <p className="text-red-400 text-sm font-medium">{error}</p>
                            </div>
                        )}
                        <p className="text-center text-slate-600 text-xs">
                            ✦ Supports Next.js App Router repositories · Private repos require{' '}
                            <code className="text-slate-500">repo</code> scope
                        </p>
                    </div>
                )}

                {/* Tab: History */}
                {tab === 'history' && (
                    <JobHistoryTab history={history} onClear={clearHistory} />
                )}
            </div>
        </main>
    );
}

function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 -mb-px ${active
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
                }`}
        >
            {children}
        </button>
    );
}
