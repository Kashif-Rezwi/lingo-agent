'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Image from 'next/image';
import { useJobStream } from '@/hooks/use-job-stream';
import { LogStream } from '@/components/log-stream';
import { ResultCard } from '@/components/result-card';

interface JobPageProps {
    params: { jobId: string };
}

export default function JobPage({ params }: JobPageProps) {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') router.replace('/login');
    }, [status, router]);

    const { logs, result, error, isStreaming } = useJobStream(params.jobId);

    if (status === 'loading') {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="animate-spin-slow rounded-full h-8 w-8 border-2 border-indigo-500/30 border-t-indigo-400" />
            </main>
        );
    }

    const isLive = isStreaming && !result && !error;

    return (
        <main className="min-h-screen">
            {/* Header */}
            <header className="border-b border-white/5 py-4 px-6 flex items-center justify-between glass sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="text-slate-500 hover:text-slate-300 transition-colors text-sm flex items-center gap-1.5"
                    >
                        ← Back
                    </button>
                    <span className="text-slate-700">|</span>
                    <span className="text-lg font-bold tracking-tight text-white">
                        Lingo<span className="text-indigo-400">Agent</span>
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {/* Live status badge */}
                    {isLive && (
                        <span className="flex items-center gap-1.5 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/25 rounded-full px-2.5 py-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
                            Live
                        </span>
                    )}
                    {result && (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2.5 py-1">
                            ✓ Done
                        </span>
                    )}
                    {error && !isStreaming && (
                        <span className="flex items-center gap-1.5 text-xs text-red-300 bg-red-500/10 border border-red-500/25 rounded-full px-2.5 py-1">
                            ✕ Failed
                        </span>
                    )}
                    {session?.user?.image && (
                        <Image
                            src={session.user.image}
                            alt={session.user.name ?? 'User'}
                            width={28}
                            height={28}
                            className="rounded-full ring-2 ring-indigo-500/30"
                        />
                    )}
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-6 py-10 space-y-8 animate-fade-up">
                {/* Heading */}
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight text-white">
                        {result ? 'Pipeline complete 🎉' : error && !isStreaming ? 'Pipeline failed' : 'Running pipeline…'}
                    </h1>
                    <p className="text-slate-600 text-xs font-mono">{params.jobId}</p>
                </div>

                {/* Connecting spinner */}
                {logs.length === 0 && isStreaming && (
                    <div className="flex items-center gap-3 text-slate-400 text-sm animate-fade-in">
                        <span className="animate-spin-slow rounded-full h-4 w-4 border-2 border-indigo-500/30 border-t-indigo-400 flex-shrink-0" />
                        Connecting to pipeline…
                    </div>
                )}

                {/* Log stream */}
                {(logs.length > 0 || isStreaming) && (
                    <div className="animate-fade-in">
                        <LogStream
                            logs={logs}
                            isStreaming={isStreaming}
                            isComplete={!!result}
                            hasError={!!error && !isStreaming}
                        />
                    </div>
                )}

                {/* Result */}
                {result && (
                    <div className="animate-fade-up">
                        <ResultCard result={result} />
                    </div>
                )}

                {/* Error */}
                {error && !isStreaming && (
                    <div className="animate-fade-in glass border border-red-500/20 rounded-xl p-5 space-y-3">
                        <p className="text-red-400 font-semibold text-sm">Pipeline failed</p>
                        <p className="text-red-300/70 text-sm leading-relaxed">{error}</p>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors"
                        >
                            ← Start a new job
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
