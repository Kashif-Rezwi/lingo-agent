'use client';

import { useState } from 'react';
import { SUPPORTED_LOCALES, DEMO_LOCALES } from '@/lib/constants';

interface RepoInputFormProps {
    onSubmit: (repoUrl: string, locales: string[]) => void;
    isLoading: boolean;
    isStreaming: boolean;
}

export function RepoInputForm({ onSubmit, isLoading, isStreaming }: RepoInputFormProps) {
    const [repoUrl, setRepoUrl] = useState('');
    const [selectedLocales, setSelectedLocales] = useState<string[]>(DEMO_LOCALES);
    const [error, setError] = useState('');

    const isBusy = isLoading || isStreaming;

    function toggleLocale(code: string) {
        setSelectedLocales((prev) =>
            prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code],
        );
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        if (!repoUrl.trim().startsWith('https://github.com/')) {
            setError('Please enter a valid GitHub HTTPS URL (e.g. https://github.com/owner/repo).');
            return;
        }
        if (selectedLocales.length === 0) {
            setError('Please select at least one target language.');
            return;
        }
        onSubmit(repoUrl.trim(), selectedLocales);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Repo URL Input */}
            <div className="space-y-2">
                <label htmlFor="repo-url" className="text-sm font-medium text-slate-300">
                    GitHub Repository URL
                </label>
                <input
                    id="repo-url"
                    type="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    disabled={isBusy}
                    required
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/60 disabled:opacity-50 transition-all"
                />
            </div>

            {/* Language Selector */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-300">Target Languages</label>
                    <span className="text-xs text-slate-500">{selectedLocales.length} selected</span>
                </div>
                <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto pr-1">
                    {SUPPORTED_LOCALES.map(({ code, label }) => {
                        const active = selectedLocales.includes(code);
                        return (
                            <button
                                key={code}
                                type="button"
                                onClick={() => toggleLocale(code)}
                                disabled={isBusy}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 disabled:opacity-40 ${active
                                        ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                                    }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Error */}
            {error && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                    {error}
                </p>
            )}

            {/* Submit */}
            <button
                type="submit"
                disabled={isBusy}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
            >
                {isLoading ? 'Starting…' : isStreaming ? 'Running pipeline…' : '🌍 Add Multilingual Support'}
            </button>
        </form>
    );
}
