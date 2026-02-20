'use client';

import { useState } from 'react';
import { DEMO_LOCALES } from '@/lib/constants';
import { LanguageSelector } from './language-selector';

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

            {/* Language Selector — standalone extracted component */}
            <LanguageSelector
                selected={selectedLocales}
                onChange={setSelectedLocales}
                disabled={isBusy}
            />

            {/* Validation Error */}
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
