'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL } from '@/lib/constants';
import { getJob } from '@/lib/api-client';
import type { LogEntry, AgentResult } from '@/types/job';
import type { AgentEvent } from '@/types/agent';

interface UseJobStreamResult {
    logs: LogEntry[];
    result: AgentResult | null;
    error: string | null;
    isStreaming: boolean;
    isLoading: boolean;
}

/** Fetches initial job state, and opens a native EventSource SSE connection if still running. */
export function useJobStream(jobId: string | null, githubToken?: string | null): UseJobStreamResult {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [result, setResult] = useState<AgentResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const esRef = useRef<EventSource | null>(null);

    const cleanup = useCallback(() => {
        if (esRef.current) {
            esRef.current.close();
            esRef.current = null;
        }
        setIsStreaming(false);
    }, []);

    useEffect(() => {
        if (!jobId || !githubToken) return;

        let active = true;

        async function init() {
            setLogs([]);
            setResult(null);
            setError(null);
            setIsStreaming(false);
            setIsLoading(true);

            try {
                const job = await getJob(jobId!, githubToken!);
                if (!active) return;

                if (job.status === 'completed') {
                    setResult({ prUrl: job.prUrl, previewUrl: job.previewUrl });
                    if (job.logs && Array.isArray(job.logs)) setLogs(job.logs as any);
                    setIsLoading(false);
                    return;
                } else if (job.status === 'failed') {
                    setError(job.error || 'Job failed');
                    if (job.logs && Array.isArray(job.logs)) setLogs(job.logs as any);
                    setIsLoading(false);
                    return;
                }

                // If running or pending, start the SSE stream
                setIsStreaming(true);
                setIsLoading(false);
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

            } catch (err) {
                if (active) {
                    setError('Failed to fetch job status.');
                    setIsStreaming(false);
                    setIsLoading(false);
                }
            }
        }

        init();

        return () => {
            active = false;
            cleanup();
        };
    }, [jobId, githubToken, cleanup]);

    return { logs, result, error, isStreaming, isLoading };
}
