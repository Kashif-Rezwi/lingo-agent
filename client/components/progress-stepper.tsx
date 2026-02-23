import { PIPELINE_STEPS } from '@/lib/constants';

interface ProgressStepperProps {
    currentStep: string | null;
    isComplete: boolean;
    hasError: boolean;
}

// Solid flat SVG icons — one per pipeline step
const CloneIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a10 10 0 0 1 0 20A10 10 0 0 1 12 2zm0 2a8 8 0 0 0 0 16A8 8 0 0 0 12 4zm1 4v4h4l-5 5-5-5h4V8h2z" />
    </svg>
);

const DetectIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
);

const AnalyzeIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z" />
    </svg>
);

const ConfigureIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
);

const TranslateIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="m12.87 15.07-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7 1.62-4.33L19.12 17h-3.24z" />
    </svg>
);

const CommitIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5 2.24-5 5-5 5 2.24 5 5zm-5-7.93V2l-4 4 4 4V7.07C14.06 7.56 16 9.58 16 12s-1.94 4.44-4 4.93V18.9c3.06-.49 6-3.08 6-6.9 0-3.82-2.94-6.41-6-6.93zM8 12c0-2.42 1.94-4.44 4-4.93V5.07C8.94 5.56 6 8.18 6 12c0 3.82 2.94 6.41 6 6.9v-2.07C9.94 16.44 8 14.42 8 12z" />
    </svg>
);

const DeployIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
    </svg>
);

const STEP_ICON_COMPONENTS: Record<string, React.FC> = {
    clone_repo: CloneIcon,
    detect_framework: DetectIcon,
    analyze_repo: AnalyzeIcon,
    setup_lingo: ConfigureIcon,
    install_and_translate: TranslateIcon,
    commit_and_push: CommitIcon,
    trigger_preview: DeployIcon,
};

export function ProgressStepper({ currentStep, isComplete, hasError }: ProgressStepperProps) {
    const currentIndex = PIPELINE_STEPS.findIndex((s) => s.id === currentStep);

    return (
        <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pipeline</p>
            <div className="flex items-center gap-1 flex-nowrap overflow-x-auto scrollbar-hide pb-2 -mb-2">
                {PIPELINE_STEPS.map((step, idx) => {
                    const isDone = isComplete || (currentIndex >= 0 && idx < currentIndex);
                    const isActive = currentIndex >= 0 && idx === currentIndex && !isComplete && !hasError;
                    const isErrored = hasError && idx === currentIndex;

                    let cls = 'bg-slate-800/60 border-slate-700/60 text-slate-500';
                    if (isErrored) cls = 'bg-red-500/10 border-red-500/40 text-red-400';
                    else if (isDone) cls = 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400';
                    else if (isActive) cls = 'bg-indigo-500/15 border-indigo-500/50 text-indigo-300 shadow-sm shadow-indigo-500/20';

                    const Icon = STEP_ICON_COMPONENTS[step.id];

                    return (
                        <div key={step.id} className="flex items-center gap-1 flex-shrink-0">
                            <div
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors duration-300 ${cls} ${isActive ? 'animate-pulse' : ''}`}
                            >
                                {Icon && <Icon />}
                                <span>{step.label}</span>
                            </div>
                            {idx < PIPELINE_STEPS.length - 1 && (
                                <div
                                    className={`h-px w-4 flex-shrink-0 transition-colors duration-500 ${isDone ? 'bg-emerald-500/50' : 'bg-slate-700/60'}`}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
