export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/** Lingo.dev supports 26 locale codes across the CLI. */
export const SUPPORTED_LOCALES: { code: string; label: string }[] = [
    { code: 'ar', label: 'Arabic' },
    { code: 'zh', label: 'Chinese (Simplified)' },
    { code: 'zh-TW', label: 'Chinese (Traditional)' },
    { code: 'cs', label: 'Czech' },
    { code: 'da', label: 'Danish' },
    { code: 'nl', label: 'Dutch' },
    { code: 'fi', label: 'Finnish' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'el', label: 'Greek' },
    { code: 'he', label: 'Hebrew' },
    { code: 'hi', label: 'Hindi' },
    { code: 'hu', label: 'Hungarian' },
    { code: 'id', label: 'Indonesian' },
    { code: 'it', label: 'Italian' },
    { code: 'ja', label: 'Japanese' },
    { code: 'ko', label: 'Korean' },
    { code: 'no', label: 'Norwegian' },
    { code: 'pl', label: 'Polish' },
    { code: 'pt', label: 'Portuguese' },
    { code: 'pt-BR', label: 'Portuguese (Brazil)' },
    { code: 'ro', label: 'Romanian' },
    { code: 'ru', label: 'Russian' },
    { code: 'es', label: 'Spanish' },
    { code: 'sv', label: 'Swedish' },
    { code: 'tr', label: 'Turkish' },
    { code: 'uk', label: 'Ukrainian' },
    { code: 'vi', label: 'Vietnamese' },
];

/** Demo target locales — French, Arabic, Japanese. Always used for the live demo. */
export const DEMO_LOCALES = ['fr', 'ar', 'ja'];

/** Ordered list of pipeline steps for the progress stepper. */
export const PIPELINE_STEPS = [
    { id: 'clone_repo', label: 'Clone' },
    { id: 'detect_framework', label: 'Detect' },
    { id: 'analyze_repo', label: 'Analyze' },
    { id: 'setup_lingo', label: 'Configure' },
    { id: 'install_and_translate', label: 'Translate' },
    { id: 'commit_and_push', label: 'Commit' },
    { id: 'trigger_preview', label: 'Deploy' },
];
