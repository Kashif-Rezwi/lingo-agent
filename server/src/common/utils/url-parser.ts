/** Parses GitHub repo URL into owner/repo components, throwing for invalid/non-GitHub inputs. */
export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const trimmed = url.trim().replace(/\.git$/, '');

  // HTTPS format: https://github.com/owner/repo
  const httpsMatch = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  // SSH format: git@github.com:owner/repo
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+)$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // Reject other hosts explicitly
  if (trimmed.includes('gitlab.com') || trimmed.includes('bitbucket.org')) {
    throw new Error(
      `Only GitHub repositories are supported. Received: ${url}`,
    );
  }

  throw new Error(
    `Invalid GitHub URL: "${url}". Expected format: https://github.com/owner/repo`,
  );
}

/** Builds authenticated HTTPS clone URL embedding the token. */
export function buildAuthenticatedCloneUrl(
  owner: string,
  repo: string,
  token: string,
): string {
  return `https://${token}@github.com/${owner}/${repo}.git`;
}
