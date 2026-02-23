'use client';

import { useRouter } from 'next/navigation';
import type { HistoryEntry } from '@/hooks/use-job-history';

interface JobHistoryTabProps {
    history: HistoryEntry[];
    onClear: () => void;
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

const StatusBadge = ({ status }: { status: HistoryEntry['status'] }) => {
    if (status === 'done') return (
        <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Done
        </span>
    );
    if (status === 'failed') return (
        <span className="flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Failed
        </span>
    );
    return (
        <span className="flex items-center gap-1 text-[10px] font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/25 rounded-full px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" /> Running
        </span>
    );
};

export function JobHistoryTab({ history, onClear }: JobHistoryTabProps) {
    const router = useRouter();

    if (history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center">
                    <svg className="w-6 h-6 text-slate-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
                    </svg>
                </div>
                <p className="text-slate-500 text-sm">No previous jobs yet.</p>
                <p className="text-slate-600 text-xs">Jobs you run will appear here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between relative z-10 pb-4">
                <p className="text-xs text-slate-500">{history.length} job{history.length !== 1 ? 's' : ''}</p>
                <button
                    onClick={onClear}
                    className="text-[11px] text-slate-600 hover:text-red-400 transition-colors"
                >
                    Clear history
                </button>
            </div>

            <div
                className="space-y-2.5 max-h-[400px] overflow-y-auto px-1 scrollbar-hide relative"
                style={{
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)',
                    paddingTop: '16px',
                    paddingBottom: '16px',
                    marginTop: '-8px' // offset the padding so visual space stays the same
                }}
            >
                {history.map((job) => {
                    const repoName = job.repoUrl.replace('https://github.com/', '');
                    return (
                        <button
                            key={job.jobId}
                            onClick={() => router.push(`/jobs/${job.jobId}?from=history`)}
                            className="w-full text-left glass rounded-xl p-4 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all duration-200 group border border-white/5"
                        >
                            <div className="flex items-start gap-3">
                                {/* Repo icon */}
                                <div className="mt-0.5 w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                                    </svg>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-medium text-white truncate group-hover:text-indigo-300 transition-colors">
                                            {repoName}
                                        </p>
                                        <StatusBadge status={job.status} />
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {job.locales.map((l) => (
                                            <span key={l} className="text-[10px] text-slate-500 bg-slate-800/60 border border-slate-700/40 rounded px-1.5 py-0.5">
                                                {l}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[11px] text-slate-600">{timeAgo(job.startedAt)}</p>
                                        {job.prUrl && (
                                            <a
                                                href={job.prUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                                            >
                                                View PR →
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
