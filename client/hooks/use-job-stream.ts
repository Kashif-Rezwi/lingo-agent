'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL } from '@/lib/constants';
import type { LogEntry, AgentResult } from '@/types/job';
import type { AgentEvent } from '@/types/agent';

interface UseJobStreamResult {
    logs: LogEntry[];
    result: AgentResult | null;
    error: string | null;
    isStreaming: boolean;
}

/** Opens a native EventSource SSE connection to the backend job stream. */
export function useJobStream(jobId: string | null): UseJobStreamResult {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [result, setResult] = useState<AgentResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const esRef = useRef<EventSource | null>(null);

    const cleanup = useCallback(() => {
        if (esRef.current) {
            esRef.current.close();
            esRef.current = null;
        }
        setIsStreaming(false);
    }, []);

    useEffect(() => {
        if (!jobId) return;

        // Reset state on new job
        setLogs([]);
        setResult(null);
        setError(null);
        setIsStreaming(true);

        const es = new EventSource(`${API_URL}/agent/stream/${jobId}`);
        esRef.current = es;

        es.onmessage = (e: MessageEvent<string>) => {
            try {
                const event = JSON.parse(e.data) as AgentEvent;

                if (event.type === 'log') {
                    setLogs((prev) => [...prev, event.data]);
                } else if (event.type === 'complete') {
                    setResult(event.data);
                    cleanup();
                } else if (event.type === 'error') {
                    setError(event.data.message);
                    cleanup();
                }
            } catch {
                // Ignore malformed event data
            }
        };

        es.onerror = () => {
            setError('Lost connection to the server. Please try again.');
            cleanup();
        };

        return cleanup;
    }, [jobId, cleanup]);

    return { logs, result, error, isStreaming };
}
