'use client';

import { useState } from 'react';
import { SUPPORTED_LOCALES } from '@/lib/constants';

interface LanguageSelectorProps {
    selected: string[];
    onChange: (locales: string[]) => void;
    disabled?: boolean;
}

/** Number of locales to show before the expand button. */
const INITIAL_VISIBLE = 13;

export function LanguageSelector({ selected, onChange, disabled }: LanguageSelectorProps) {
    const [expanded, setExpanded] = useState(false);

    function toggle(code: string) {
        onChange(
            selected.includes(code)
                ? selected.filter((l) => l !== code)
                : [...selected, code],
        );
    }

    const visible = expanded ? SUPPORTED_LOCALES : SUPPORTED_LOCALES.slice(0, INITIAL_VISIBLE);
    const hiddenCount = SUPPORTED_LOCALES.length - INITIAL_VISIBLE;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">Target Languages</label>
                <span className="text-xs text-slate-500 tabular-nums">
                    {selected.length} selected
                </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {visible.map(({ code, label }) => {
                    const active = selected.includes(code);
                    return (
                        <button
                            key={code}
                            type="button"
                            onClick={() => toggle(code)}
                            disabled={disabled}
                            className={`
                px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 disabled:opacity-40
                ${active
                                    ? 'bg-indigo-500/20 border border-indigo-500/50 text-indigo-300 shadow-sm shadow-indigo-500/20'
                                    : 'bg-slate-800/50 border border-slate-700/40 text-slate-400 hover:border-slate-600/60 hover:text-slate-300 hover:bg-slate-700/40'
                                }
              `}
                        >
                            {label}
                        </button>
                    );
                })}

                {/* Expand / collapse button */}
                {!expanded ? (
                    <button
                        type="button"
                        onClick={() => setExpanded(true)}
                        disabled={disabled}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border border-dashed border-slate-600/50 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all duration-150 disabled:opacity-40"
                    >
                        + {hiddenCount} more
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => setExpanded(false)}
                        disabled={disabled}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border border-dashed border-slate-600/50 text-slate-500 hover:text-slate-300 hover:border-slate-500/50 transition-all duration-150 disabled:opacity-40"
                    >
                        Show less
                    </button>
                )}
            </div>
        </div>
    );
}
