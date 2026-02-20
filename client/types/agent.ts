import type { LogEntry, AgentResult } from './job';

export interface SseLogEvent {
    type: 'log';
    data: LogEntry;
}

export interface SseProgressEvent {
    type: 'progress';
    data: { step: string; percent: number };
}

export interface SseCompleteEvent {
    type: 'complete';
    data: AgentResult;
}

export interface SseErrorEvent {
    type: 'error';
    data: { message: string; step: string };
}

export type AgentEvent = SseLogEvent | SseProgressEvent | SseCompleteEvent | SseErrorEvent;
