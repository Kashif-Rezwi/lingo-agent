export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type LogLevel = 'info' | 'success' | 'error' | 'warn';

export interface LogEntry {
    message: string;
    level: LogLevel;
    timestamp: string;
    step?: string;
}

export interface AgentResult {
    prUrl: string;
    previewUrl: string;
}

export interface Job {
    id: string;
    repoUrl: string;
    locales: string[];
    status: JobStatus;
    prUrl?: string;
    previewUrl?: string;
    error?: string;
    createdAt: string;
}
