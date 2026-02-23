'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { cancelJob } from '@/lib/api-client';
import { useJobStream } from '@/hooks/use-job-stream';
import { useJobHistory } from '@/hooks/use-job-history';
import { LogStream } from '@/components/log-stream';
import { ResultCard } from '@/components/result-card';

interface JobPageProps {
    params: { jobId: string };
}

/** Pure canvas confetti burst — fires 120 particles and cleans up after 3s. No npm deps needed. */
function fireConfetti() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:99999;';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d')!;
    const COLORS = ['#4f46e5', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
    const particles = Array.from({ length: 120 }, () => ({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2 - 100,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 1) * 14,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.3,
        w: 8 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 1,
    }));
    let frame: number;
    const GRAVITY = 0.35;
    const start = performance.now();
    function draw(ts: number) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const elapsed = ts - start;
        const fade = Math.max(0, 1 - elapsed / 2500);
        for (const p of particles) {
            p.vy += GRAVITY;
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.rotV;
            p.alpha = fade;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        }
        if (elapsed < 3000) frame = requestAnimationFrame(draw);
        else { canvas.remove(); cancelAnimationFrame(frame); }
    }
    frame = requestAnimationFrame(draw);
}

export default function JobPage({ params }: JobPageProps) {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') router.replace('/login');
    }, [status, router]);

    const { logs: streamLogs, result, error, isStreaming, isLoading } = useJobStream(params.jobId, session?.githubToken);
    const [isCancelling, setIsCancelling] = useState(false);
    const { history, updateJob } = useJobHistory();
    const [didUpdate, setDidUpdate] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const confettiFired = useRef(false);

    const historyEntry = history.find((e) => e.jobId === params.jobId);
    const displayLogs = streamLogs.length > 0 ? streamLogs : (historyEntry?.logs || []);

    useEffect(() => {
        if (streamLogs.length > 0) {
            updateJob(params.jobId, { logs: streamLogs });
        }
    }, [streamLogs, params.jobId, updateJob]);

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
        if (didUpdate) return;
        if (result) {
            updateJob(params.jobId, { status: 'done', prUrl: result.prUrl, previewUrl: result.previewUrl });
            setDidUpdate(true);
            // Fire confetti once on successful completion
            if (!confettiFired.current) {
                confettiFired.current = true;
                fireConfetti();
            }
        } else if (error && !isStreaming) {
            updateJob(params.jobId, { status: 'failed' });
            setDidUpdate(true);
        }
    }, [result, error, isStreaming, didUpdate, updateJob, params.jobId]);

    const handleCancel = async () => {
        if (!session?.githubToken) return;
        try {
            setIsCancelling(true);
            await cancelJob(params.jobId, session.githubToken);
        } catch (err) {
            console.error('Failed to cancel job', err);
            setIsCancelling(false); // only reset on error, stream unmounts on success
        }
    };

    if (status === 'loading') {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="animate-spin-slow rounded-full h-8 w-8 border-2 border-indigo-500/30 border-t-indigo-400" />
            </main>
        );
    }

    const isLive = isStreaming && !result && !error;

    const handleBack = () => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('from') === 'history') {
                router.push('/dashboard?t=history');
                return;
            }
        }
        router.push('/dashboard');
    };

    return (
        <main className="min-h-screen">
            {/* Header */}
            <header className="border-b border-white/5 py-4 px-6 flex items-center justify-between glass fixed top-0 w-full z-50 left-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleBack}
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
                    {/* Live status badge & Stop button */}
                    {isLive && !isLoading && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleCancel}
                                disabled={isCancelling}
                                className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 hover:border-red-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-red-500/10"
                                title="End pipeline immediately"
                            >
                                {isCancelling ? (
                                    <span className="h-3 w-3 rounded-full border-2 border-red-400 border-t-red-500/20 animate-spin" />
                                ) : (
                                    <svg className="w-3 h-3 fill-current transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                                        <rect x="6" y="6" width="12" height="12" rx="2" />
                                    </svg>
                                )}
                                {isCancelling ? 'Stopping...' : 'End Pipeline'}
                            </button>
                            <span className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2.5 py-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Live
                            </span>
                        </div>
                    )}
                    {result && !isLoading && (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2.5 py-1">
                            ✓ Done
                        </span>
                    )}
                    {error && !isStreaming && !isLoading && (
                        <span className="flex items-center gap-1.5 text-xs text-red-300 bg-red-500/10 border border-red-500/25 rounded-full px-2.5 py-1">
                            ✕ Failed
                        </span>
                    )}
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
                            <div className="absolute right-0 mt-2 w-56 z-20 bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
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
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-6 pt-28 pb-10 space-y-8 animate-fade-up">
                {/* Heading */}
                <div className="space-y-1">
                    {isLoading ? (
                        <>
                            <div className="h-8 w-64 bg-white/5 rounded-lg animate-pulse mb-2" />
                            <div className="h-4 w-48 bg-white/5 rounded animate-pulse" />
                        </>
                    ) : (
                        <>
                            <h1 className="text-2xl font-bold tracking-tight text-white">
                                {result ? 'Pipeline complete 🎉' : error && !isStreaming ? 'Pipeline failed' : 'Translating repository…'}
                            </h1>
                            <p className="text-slate-600 text-xs font-mono">{params.jobId}</p>
                        </>
                    )}
                </div>

                {isLoading ? (
                    <div className="space-y-8 animate-fade-in">
                        {/* Stepper Skeleton */}
                        <div className="space-y-4">
                            <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
                            <div className="flex gap-2.5 overflow-hidden">
                                {[...Array(7)].map((_, i) => (
                                    <div key={i} className="h-7 w-24 bg-white/5 rounded-full animate-pulse flex-shrink-0" />
                                ))}
                            </div>
                        </div>
                        {/* Terminal Skeleton */}
                        <div className="h-72 w-full bg-[#05050c] border border-white/5 rounded-xl animate-pulse" />
                    </div>
                ) : (
                    <>
                        {/* Connecting spinner */}
                        {displayLogs.length === 0 && isStreaming && (
                            <div className="flex items-center gap-3 text-slate-400 text-sm animate-fade-in">
                                <span className="animate-spin-slow rounded-full h-4 w-4 border-2 border-indigo-500/30 border-t-indigo-400 flex-shrink-0" />
                                Connecting to pipeline…
                            </div>
                        )}

                        {/* Log stream */}
                        {(displayLogs.length > 0 || isStreaming) && (
                            <div className="animate-fade-in">
                                <LogStream
                                    logs={displayLogs}
                                    isStreaming={isStreaming}
                                    isComplete={!!result || historyEntry?.status === 'done'}
                                    hasError={(!!error && !isStreaming) || historyEntry?.status === 'failed'}
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
                    </>
                )}
            </div>
        </main>
    );
}
