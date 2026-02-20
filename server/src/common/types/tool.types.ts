import type { LogEntry } from './agent.types.js';

// Function signature for emitting real-time log events from within a tool
export type EmitFn = (entry: LogEntry) => void;

// --- clone_repo ---
export interface CloneRepoInput {
  repoUrl: string;
  githubToken: string;
}

export interface CloneRepoOutput {
  sandboxId: string;
  workDir: string;
}

// --- detect_framework ---
export interface DetectFrameworkInput {
  sandboxId: string;
  workDir: string;
}

export interface DetectFrameworkOutput {
  framework: 'nextjs-app-router' | 'nextjs-pages' | 'unknown';
}

// --- analyze_repo ---
export interface AnalyzeRepoInput {
  sandboxId: string;
  workDir: string;
}

export interface AnalyzeRepoOutput {
  hasExistingI18n: boolean;
  existingI18nLibrary: string | null;
  layoutPath: string;
  nextConfigPath: string;
  jsxFileCount: number;
}

// --- setup_lingo ---
export interface SetupLingoInput {
  sandboxId: string;
  workDir: string;
  framework: string;
  locales: string[];
  layoutPath: string;
  nextConfigPath: string;
}

export interface SetupLingoOutput {
  modifiedFiles: string[];
}

// --- install_and_translate ---
export interface InstallTranslateInput {
  sandboxId: string;
  workDir: string;
}

export interface InstallTranslateOutput {
  generatedLocales: string[];
  wordCounts: Record<string, number>;
}

// --- commit_and_push ---
export interface CommitPushInput {
  sandboxId: string;
  workDir: string;
  repoUrl: string;
  githubToken: string;
  locales: string[];
}

export interface CommitPushOutput {
  branchName: string;
  prUrl: string;
}

// --- trigger_preview ---
export interface TriggerPreviewInput {
  repoUrl: string;
  branchName: string;
}

export interface TriggerPreviewOutput {
  previewUrl: string;
}
