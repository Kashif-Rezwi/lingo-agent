import { API_URL } from './constants';

interface StartJobOptions {
    repoUrl: string;
    locales: string[];
    githubToken: string;
}

interface StartJobResponse {
    jobId: string;
}

/** Posts to /api/agent/run and returns the job ID for SSE stream subscription. */
export async function startJob(opts: StartJobOptions): Promise<StartJobResponse> {
    const res = await fetch(`${API_URL}/agent/run`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${opts.githubToken}`,
        },
        body: JSON.stringify({
            repoUrl: opts.repoUrl,
            locales: opts.locales,
            githubToken: opts.githubToken,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error((err as { message: string }).message ?? `Request failed: ${res.status}`);
    }

    return res.json() as Promise<StartJobResponse>;
}
