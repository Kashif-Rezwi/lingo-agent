import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';

export interface FileChange {
  path: string;
  content: string; // UTF-8 string content
}

export interface PullRequestResult {
  url: string;
  number: number;
}

/** Wraps the GitHub REST API statelessly; Octokit is instantiated per-call for fresh credentials. */
@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  private client(token: string): Octokit {
    return new Octokit({ auth: token });
  }

  /** Returns the repository's default branch name (e.g. 'main' or 'master'). */
  async getDefaultBranch(owner: string, repo: string, token: string): Promise<string> {
    const { data } = await this.client(token).repos.get({ owner, repo });
    return data.default_branch;
  }

  /** Returns the latest commit SHA on a given branch. Required for branch creation. */
  async getLatestCommitSha(
    owner: string,
    repo: string,
    branch: string,
    token: string,
  ): Promise<string> {
    const { data } = await this.client(token).repos.getBranch({ owner, repo, branch });
    return data.commit.sha;
  }

  /** Creates a new branch off the given base commit SHA. */
  async createBranch(
    owner: string,
    repo: string,
    branchName: string,
    baseSha: string,
    token: string,
  ): Promise<void> {
    await this.client(token).git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });
    this.logger.log(`Branch created: ${branchName}`);
  }

  /** Commits multiple files atomically using the Git Data API, avoiding local git requirements. */
  async commitFiles(
    owner: string,
    repo: string,
    branch: string,
    baseSha: string,
    files: FileChange[],
    message: string,
    token: string,
  ): Promise<void> {
    const octokit = this.client(token);

    // 1. Create a blob for each file
    const blobs = await Promise.all(
      files.map((f) =>
        octokit.git.createBlob({
          owner,
          repo,
          content: Buffer.from(f.content).toString('base64'),
          encoding: 'base64',
        }),
      ),
    );

    // 2. Create a new tree referencing the base tree + new blobs
    const { data: tree } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseSha,
      tree: files.map((f, i) => ({
        path: f.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blobs[i].data.sha,
      })),
    });

    // 3. Create a commit pointing to the new tree
    const { data: commit } = await octokit.git.createCommit({
      owner,
      repo,
      message,
      tree: tree.sha,
      parents: [baseSha],
    });

    // 4. Update the branch ref to point to the new commit
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: commit.sha,
    });

    this.logger.log(`Committed ${files.length} file(s) to ${branch}`);
  }

  /** Opens a pull request and returns its URL and number. */
  async createPullRequest(
    owner: string,
    repo: string,
    head: string,
    base: string,
    title: string,
    body: string,
    token: string,
  ): Promise<PullRequestResult> {
    const { data } = await this.client(token).pulls.create({
      owner,
      repo,
      head,
      base,
      title,
      body,
    });
    this.logger.log(`PR opened: ${data.html_url}`);
    return { url: data.html_url, number: data.number };
  }
}
