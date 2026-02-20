import type { LogEntry } from '@/types/job';

const LEVEL_STYLES: Record<string, string> = {
    info: 'text-blue-400',
    success: 'text-emerald-400',
    error: 'text-red-400',
    warn: 'text-amber-400',
};

const LEVEL_DOTS: Record<string, string> = {
    info: 'bg-blue-400',
    success: 'bg-emerald-400',
    error: 'bg-red-400',
    warn: 'bg-amber-400',
};

interface LogEntryProps {
    entry: LogEntry;
}

export function LogEntryRow({ entry }: LogEntryProps) {
    const textClass = LEVEL_STYLES[entry.level] ?? 'text-slate-400';
    const dotClass = LEVEL_DOTS[entry.level] ?? 'bg-slate-400';

    return (
        <div className="flex items-start gap-3 py-1">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
            <div className="flex-1 min-w-0">
                {entry.step && (
                    <span className="text-slate-500 text-xs font-mono mr-2">[{entry.step}]</span>
                )}
                <span className={`text-sm font-mono ${textClass}`}>{entry.message}</span>
            </div>
        </div>
    );
}
