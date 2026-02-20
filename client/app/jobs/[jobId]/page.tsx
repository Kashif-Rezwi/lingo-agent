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
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="text-slate-500 hover:text-slate-300 transition-colors text-sm flex items-center gap-1.5"
                    >
                        ← Back
                    </button>
                    <span className="text-slate-700">|</span>
                    <span className="text-xl font-bold tracking-tight">
                        Lingo<span className="text-indigo-400">Agent</span>
                    </span>
                </div>
                {session?.user?.image && (
                    <Image
                        src={session.user.image}
                        alt={session.user.name ?? 'User'}
                        width={28}
                        height={28}
                        className="rounded-full ring-2 ring-slate-700"
                    />
                )}
            </header>

            <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
                {/* Job ID badge */}
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">Pipeline Running</h1>
                    <p className="text-slate-500 text-xs font-mono">Job ID: {params.jobId}</p>
                </div>

                {/* Live log stream */}
                {(logs.length > 0 || isStreaming) && (
                    <LogStream
                        logs={logs}
                        isStreaming={isStreaming}
                        isComplete={!!result}
                        hasError={!!error && !isStreaming}
                    />
                )}

                {/* Success */}
                {result && <ResultCard result={result} />}

                {/* Error */}
                {error && !isStreaming && (
                    <div className="bg-red-950/40 border border-red-700/40 rounded-xl p-4 space-y-2">
                        <p className="text-red-400 font-medium text-sm">Pipeline failed</p>
                        <p className="text-red-300/70 text-sm">{error}</p>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="mt-2 text-xs text-slate-400 hover:text-slate-200 underline transition-colors"
                        >
                            ← Start a new job
                        </button>
                    </div>
                )}

                {/* Waiting for connection */}
                {logs.length === 0 && isStreaming && (
                    <div className="flex items-center gap-3 text-slate-400 text-sm">
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-400 flex-shrink-0" />
                        Connecting to pipeline…
                    </div>
                )}
            </div>
        </main>
    );
}
