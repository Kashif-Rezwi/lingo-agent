import type { LogEntry } from '@/types/job';

const STATUS_STYLES: Record<string, { dot: string; text: string }> = {
    info: { dot: 'bg-slate-500', text: 'text-slate-300' },
    success: { dot: 'bg-emerald-400', text: 'text-emerald-300' },
    error: { dot: 'bg-red-400', text: 'text-red-300' },
    warn: { dot: 'bg-yellow-400', text: 'text-yellow-300' },
};

export function LogEntryRow({ entry }: { entry: LogEntry }) {
    const style = STATUS_STYLES[entry.level] ?? STATUS_STYLES.info;

    return (
        <div className="log-entry flex items-start gap-2 py-0.5 leading-relaxed">
            {/* Status dot */}
            <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${style.dot}`} />
            {/* Step label */}
            {entry.step && (
                <span className="flex-shrink-0 text-[10px] text-indigo-400/70 bg-indigo-500/10 border border-indigo-500/20 rounded px-1 py-px font-mono leading-none mt-px">
                    {entry.step}
                </span>
            )}
            {/* Message */}
            <span className={`${style.text} break-all`}>{entry.message}</span>
        </div>
    );
}
