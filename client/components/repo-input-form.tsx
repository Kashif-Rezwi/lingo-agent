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

            {/* Warning Message for Multiple Locales */}
            {selectedLocales.length > 1 && (
                <div className="flex gap-3 items-start p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 text-xs leading-relaxed animate-fade-in">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p>
                        <strong>Note:</strong> Translating into multiple languages is a resource-intensive process. Please check your Lingo.dev dashboard to ensure you have enough total words left before proceeding, as this can deplete your quota quickly!
                    </p>
                </div>
            )}

            {/* Validation Error */}
            {error && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                    {error}
                </p>
            )}

            {/* Submit */}
            <button
                type="submit"
                disabled={isBusy || selectedLocales.length === 0}
                className="group w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.99] text-white font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
            >
                {isLoading ? (
                    <>
                        <span className="animate-spin-slow h-4 w-4 rounded-full border-2 border-white/30 border-t-white flex-shrink-0" />
                        Starting pipeline…
                    </>
                ) : isStreaming ? (
                    <>
                        <span className="animate-spin-slow h-4 w-4 rounded-full border-2 border-white/30 border-t-white flex-shrink-0" />
                        Pipeline running…
                    </>
                ) : (
                    <>
                        {/* Sparkle / translate icon */}
                        <svg className="w-4 h-4 flex-shrink-0 transition-transform duration-200 group-hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                        </svg>
                        Translate & Open PR
                        <svg className="w-4 h-4 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                    </>
                )}
            </button>
        </form>
    );
}
