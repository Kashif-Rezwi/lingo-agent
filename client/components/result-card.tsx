import type { AgentResult } from '@/types/job';

interface ResultCardProps {
    result: AgentResult;
}

export function ResultCard({ result }: ResultCardProps) {
    return (
        <div className="bg-emerald-950/40 border border-emerald-700/40 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
                <span className="text-2xl">🎉</span>
                <h2 className="text-emerald-400 font-semibold text-lg">Multilingual support added!</h2>
            </div>

            <div className="space-y-3">
                {/* PR Link */}
                <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pull Request</p>
                    <a
                        href={result.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors break-all group"
                    >
                        <span className="text-base">⤴</span>
                        <span className="group-hover:underline">{result.prUrl}</span>
                    </a>
                </div>

                {/* Preview URL */}
                {result.previewUrl && (
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Live Preview</p>
                        <a
                            href={result.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors break-all group"
                        >
                            <span className="text-base">🌐</span>
                            <span className="group-hover:underline">{result.previewUrl}</span>
                        </a>
                    </div>
                )}
            </div>

            <p className="text-slate-500 text-xs pt-2 border-t border-slate-800">
                Review the pull request and merge when ready. Lingo.dev will keep translations in sync on future pushes.
            </p>
        </div>
    );
}
