'use client';

import { useEffect, useRef } from 'react';
import type { LogEntry } from '@/types/job';
import { LogEntryRow } from './log-entry';
import { ProgressStepper } from './progress-stepper';

interface LogStreamProps {
    logs: LogEntry[];
    isStreaming: boolean;
    isComplete: boolean;
    hasError: boolean;
}

export function LogStream({ logs, isStreaming, isComplete, hasError }: LogStreamProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const currentStep = [...logs].reverse().find((l) => l.step)?.step ?? null;

    if (logs.length === 0 && !isStreaming) return null;

    return (
        <div className="space-y-5">
            <ProgressStepper currentStep={currentStep} isComplete={isComplete} hasError={hasError} />

            {/* Terminal window */}
            <div
                className="rounded-xl border border-white/5 overflow-hidden"
                style={{ background: '#05050c' }}
            >
                {/* Terminal title bar */}
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                    <span className="ml-3 text-xs text-slate-600 font-mono">agent output</span>
                    {isStreaming && (
                        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-indigo-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
                            streaming
                        </span>
                    )}
                </div>

                {/* Log body */}
                <div className="p-4 h-72 overflow-y-auto font-mono text-xs space-y-px scroll-smooth">
                    {logs.map((entry, i) => (
                        <LogEntryRow key={i} entry={entry} />
                    ))}
                    {isStreaming && (
                        <div className="flex items-center gap-2 pt-1 text-slate-600">
                            <span className="animate-blink">▋</span>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>
            </div>
        </div>
    );
}
