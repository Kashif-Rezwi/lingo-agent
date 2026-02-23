'use client';

import { useState, useCallback } from 'react';
import { useJobStream } from './use-job-stream';
import { startJob } from '@/lib/api-client';
import type { AgentResult, LogEntry } from '@/types/job';

interface UseAgentJobOptions {
    githubToken: string;
}

interface UseAgentJobResult {
    submit: (repoUrl: string, locales: string[]) => Promise<void>;
    jobId: string | null;
    logs: LogEntry[];
    result: AgentResult | null;
    error: string | null;
    isLoading: boolean;
    isStreaming: boolean;
}

/** Combines job submission and SSE stream into a single lifecycle hook. */
export function useAgentJob({ githubToken }: UseAgentJobOptions): UseAgentJobResult {
    const [jobId, setJobId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const { logs, result, error: streamError, isStreaming } = useJobStream(jobId, githubToken);

    const submit = useCallback(
        async (repoUrl: string, locales: string[]) => {
            setIsLoading(true);
            setSubmitError(null);
            setJobId(null);
            try {
                const { jobId: id } = await startJob({ repoUrl, locales, githubToken });
                setJobId(id);
            } catch (err) {
                setSubmitError(err instanceof Error ? err.message : 'Failed to start job.');
            } finally {
                setIsLoading(false);
            }
        },
        [githubToken],
    );

    return {
        submit,
        jobId,
        logs,
        result,
        error: submitError ?? streamError,
        isLoading,
        isStreaming,
    };
}
