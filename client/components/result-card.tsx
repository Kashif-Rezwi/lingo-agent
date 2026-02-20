'use client';

import { useState } from 'react';
import type { AgentResult } from '@/types/job';

interface ResultCardProps {
    result: AgentResult;
}

export function ResultCard({ result }: ResultCardProps) {
    const [copied, setCopied] = useState(false);

    async function copyPrUrl() {
        await navigator.clipboard.writeText(result.prUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="glass glow-emerald rounded-2xl p-6 space-y-5 border border-emerald-500/20 animate-fade-up">
            {/* Header */}
            <div className="flex items-center gap-3">
                <span className="text-2xl">🎉</span>
                <div>
                    <h2 className="text-emerald-400 font-semibold text-base">Multilingual support added!</h2>
                    <p className="text-slate-500 text-xs mt-0.5">Review the PR and merge when ready.</p>
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
                            title="Copy URL"
                            className="flex-shrink-0 px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                        >
                            {copied ? '✓ Copied' : 'Copy'}
                        </button>
                    </div>
                </div>

                {/* Preview */}
                {result.previewUrl && (
                    <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Live Preview</p>
                        <a
                            href={result.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors group"
                        >
                            <span>🌐</span>
                            <span className="group-hover:underline underline-offset-2 break-all">{result.previewUrl}</span>
                        </a>
                    </div>
                )}
            </div>

            <p className="text-slate-600 text-xs pt-3 border-t border-white/5">
                Lingo.dev will keep translations in sync on future pushes via the CI/CD action.
            </p>
        </div>
    );
}
