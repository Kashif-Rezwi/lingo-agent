import { PIPELINE_STEPS } from '@/lib/constants';

interface ProgressStepperProps {
    currentStep: string | null;
    isComplete: boolean;
    hasError: boolean;
}

export function ProgressStepper({ currentStep, isComplete, hasError }: ProgressStepperProps) {
    const currentIndex = PIPELINE_STEPS.findIndex((s) => s.id === currentStep);

    return (
        <div className="flex items-center gap-1 flex-wrap">
            {PIPELINE_STEPS.map((step, idx) => {
                const isDone = isComplete || idx < currentIndex;
                const isActive = idx === currentIndex && !isComplete;
                const isError = hasError && idx === currentIndex;

                let dotClass = 'bg-slate-700 text-slate-500';
                if (isError) dotClass = 'bg-red-500/20 text-red-400 border border-red-500/50';
                else if (isDone) dotClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50';
                else if (isActive) dotClass = 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50 animate-pulse';

                return (
                    <div key={step.id} className="flex items-center gap-1">
                        <div className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-300 ${dotClass}`}>
                            {step.label}
                        </div>
                        {idx < PIPELINE_STEPS.length - 1 && (
                            <div className={`h-px w-3 transition-all duration-300 ${isDone ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
