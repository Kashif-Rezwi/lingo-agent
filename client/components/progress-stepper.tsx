import { PIPELINE_STEPS } from '@/lib/constants';

interface ProgressStepperProps {
    currentStep: string | null;
    isComplete: boolean;
    hasError: boolean;
}

const STEP_ICONS: Record<string, string> = {
    clone_repo: '⬇',
    detect_framework: '🔍',
    analyze_repo: '📋',
    setup_lingo: '⚙',
    install_and_translate: '🌐',
    commit_and_push: '🔀',
    trigger_preview: '🚀',
};

export function ProgressStepper({ currentStep, isComplete, hasError }: ProgressStepperProps) {
    const currentIndex = PIPELINE_STEPS.findIndex((s) => s.id === currentStep);

    return (
        <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pipeline</p>
            <div className="flex items-center gap-1 flex-wrap">
                {PIPELINE_STEPS.map((step, idx) => {
                    const isDone = isComplete || (currentIndex >= 0 && idx < currentIndex);
                    const isActive = currentIndex >= 0 && idx === currentIndex && !isComplete && !hasError;
                    const isErrored = hasError && idx === currentIndex;

                    let cls = 'bg-slate-800/60 border-slate-700/60 text-slate-500';
                    if (isErrored) cls = 'bg-red-500/10 border-red-500/40 text-red-400';
                    else if (isDone) cls = 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400';
                    else if (isActive) cls = 'bg-indigo-500/15 border-indigo-500/50 text-indigo-300 shadow-sm shadow-indigo-500/20';

                    return (
                        <div key={step.id} className="flex items-center gap-1">
                            <div
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-300 ${cls} ${isActive ? 'animate-pulse' : ''}`}
                            >
                                <span className="text-[10px]">{STEP_ICONS[step.id] ?? '•'}</span>
                                <span>{step.label}</span>
                                {isDone && <span className="text-[10px]">✓</span>}
                            </div>
                            {idx < PIPELINE_STEPS.length - 1 && (
                                <div
                                    className={`h-px w-4 flex-shrink-0 transition-all duration-500 ${isDone ? 'bg-emerald-500/50' : 'bg-slate-700/60'}`}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
