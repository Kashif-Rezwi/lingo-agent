'use client';

import { useState, useEffect } from 'react';

interface Settings {
    lingoApiKey: string;
    groqApiKey: string;
}

const DEFAULT_SETTINGS: Settings = {
    lingoApiKey: '',
    groqApiKey: '',
};

export function useSettings() {
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('lingo_agent_settings');
        if (stored) {
            try {
                setSettings(JSON.parse(stored));
            } catch {
                // Ignore parse errors
            }
        }
        setIsLoaded(true);
    }, []);

    const updateSettings = (newSettings: Partial<Settings>) => {
        const updated = { ...settings, ...newSettings };
        setSettings(updated);
        localStorage.setItem('lingo_agent_settings', JSON.stringify(updated));
    };

    return { settings, updateSettings, isLoaded };
}
