'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LogEntry } from '@/types/job';

export interface HistoryEntry {
    jobId: string;
    repoUrl: string;
    locales: string[];
    startedAt: string;          // ISO string
    status: 'running' | 'done' | 'failed';
    prUrl?: string;
    previewUrl?: string;
    logs?: LogEntry[];
}

const KEY = 'lingo_job_history';
const MAX = 50;

function load(): HistoryEntry[] {
    try {
        return JSON.parse(localStorage.getItem(KEY) ?? '[]');
    } catch {
        return [];
    }
}

function save(entries: HistoryEntry[]) {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
}

export function useJobHistory() {
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    useEffect(() => {
        setHistory(load());
    }, []);

    const addJob = useCallback((entry: HistoryEntry) => {
        setHistory((prev) => {
            const next = [entry, ...prev.filter((e) => e.jobId !== entry.jobId)];
            save(next);
            return next;
        });
    }, []);

    const updateJob = useCallback((jobId: string, patch: Partial<HistoryEntry>) => {
        setHistory((prev) => {
            const next = prev.map((e) => (e.jobId === jobId ? { ...e, ...patch } : e));
            save(next);
            return next;
        });
    }, []);

    const clearHistory = useCallback(() => {
        localStorage.removeItem(KEY);
        setHistory([]);
    }, []);

    return { history, addJob, updateJob, clearHistory };
}
