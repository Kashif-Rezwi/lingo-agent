'use client';

import { SUPPORTED_LOCALES } from '@/lib/constants';

interface LanguageSelectorProps {
    selected: string[];
    onChange: (locales: string[]) => void;
    disabled?: boolean;
}

/** Multi-select locale toggle grid — standalone component extracted from RepoInputForm. */
export function LanguageSelector({ selected, onChange, disabled }: LanguageSelectorProps) {
    function toggle(code: string) {
        onChange(
            selected.includes(code)
                ? selected.filter((l) => l !== code)
                : [...selected, code],
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">Target Languages</label>
                <span className="text-xs text-slate-500">{selected.length} selected</span>
            </div>
            <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto pr-1">
                {SUPPORTED_LOCALES.map(({ code, label }) => {
                    const active = selected.includes(code);
                    return (
                        <button
                            key={code}
                            type="button"
                            onClick={() => toggle(code)}
                            disabled={disabled}
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
    );
}
