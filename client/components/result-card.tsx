'use client';

import { useState } from 'react';
import type { AgentResult } from '@/types/job';

interface ResultCardProps {
    result: AgentResult;
}

export function ResultCard({ result }: ResultCardProps) {
    const [copiedPr, setCopiedPr] = useState(false);
    const [copiedPreview, setCopiedPreview] = useState(false);

    async function copyPrUrl() {
        await navigator.clipboard.writeText(result.prUrl);
        setCopiedPr(true);
        setTimeout(() => setCopiedPr(false), 2000);
    }

    async function copyPreviewUrl() {
        if (!result.previewUrl) return;
        await navigator.clipboard.writeText(result.previewUrl);
        setCopiedPreview(true);
        setTimeout(() => setCopiedPreview(false), 2000);
    }

    return (
        <div className="glass glow-emerald rounded-2xl p-6 space-y-5 border border-emerald-500/20 animate-fade-up">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27L18.18 21L16.55 13.97L22 9.24L14.81 8.63L12 2Z" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-emerald-400 font-bold text-base tracking-tight">Your repo is now global!</h2>
                    <p className="text-slate-400 text-xs mt-0.5">Review the pull request below to merge your new languages.</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Pull Request */}
                <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pull Request</p>
                    <div className="flex items-center gap-2">
                        <a
                            href={result.prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 min-w-0 text-sm text-indigo-400 hover:text-indigo-300 transition-colors truncate group"
                        >
                            <span className="group-hover:underline underline-offset-2">{result.prUrl}</span>
                        </a>
                        <button
                            onClick={copyPrUrl}
                            title="Copy PR URL"
                            className="flex-shrink-0 px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                        >
                            {copiedPr ? '✓ Copied' : 'Copy'}
                        </button>
                    </div>
                </div>

                {/* Preview */}
                {result.previewUrl && (
                    <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Live Preview</p>
                        <div className="flex items-center gap-2">
                            <a
                                href={result.previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 min-w-0 flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors group truncate"
                            >
                                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                                </svg>
                                <span className="group-hover:underline underline-offset-2 truncate leading-loose">{result.previewUrl}</span>
                            </a>
                            <button
                                onClick={copyPreviewUrl}
                                title="Copy Preview URL"
                                className="flex-shrink-0 px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                            >
                                {copiedPreview ? '✓ Copied' : 'Copy'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <p className="text-slate-600 text-xs pt-3 border-t border-white/5">
                Lingo.dev keeps translations automatically synced on every future push via our CI/CD action.
            </p>
        </div>
    );
}
