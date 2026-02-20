export type JobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type LogLevel = 'info' | 'success' | 'error' | 'warn';

export interface LogEntry {
  message: string;
  level: LogLevel;
  timestamp: Date;
  step?: string;
}

export interface AgentResult {
  prUrl: string;
  previewUrl: string;
}
