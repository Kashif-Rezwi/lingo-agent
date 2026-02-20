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

    // Auto-scroll to bottom on new logs
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Derive current step from latest log with a step field
    const currentStep = [...logs].reverse().find((l) => l.step)?.step ?? null;

    if (logs.length === 0 && !isStreaming) return null;

    return (
        <div className="space-y-4">
            <ProgressStepper currentStep={currentStep} isComplete={isComplete} hasError={hasError} />

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 h-72 overflow-y-auto font-mono text-xs space-y-0.5 scroll-smooth">
                {logs.map((entry, i) => (
                    <LogEntryRow key={i} entry={entry} />
                ))}
                {isStreaming && (
                    <div className="flex items-center gap-2 py-1 text-slate-500">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
                        <span>Waiting for agent…</span>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
