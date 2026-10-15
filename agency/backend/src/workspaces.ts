import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';

import type { Project } from '@pixel-agency/shared';

import { safeJoin } from './util/fsAtomic.js';

const run = promisify(execFile);

export interface Workspace {
  path: string;
  branch?: string;
  baseCommit?: string;
  hasRepo: boolean;
}

/**
 * Isolated per-mission workspaces. Every task mission gets its own fresh
 * shallow clone on its own branch, so parallel missions (even on the same
 * project) can never step on each other. Chat conversations reuse one
 * workspace per (project, agent) so a resumed Claude session keeps its cwd.
 *
 * The GitHub token is only ever handed to git as a one-shot `-c
 * http.extraHeader` — it is never written to `.git/config`, the remote URL,
 * or the agent's environment.
 */
export class WorkspaceManager {
  constructor(
    private readonly root: string,
    private readonly githubToken?: string,
  ) {
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  }

  private authArgs(): string[] {
    if (!this.githubToken) return [];
    const basic = Buffer.from(`x-access-token:${this.githubToken}`).toString('base64');
    return ['-c', `http.https://github.com/.extraHeader=Authorization: Basic ${basic}`];
  }

  private async git(cwd: string, args: string[], timeoutMs = 120_000): Promise<string> {
    const { stdout } = await run('git', [...this.authArgs(), ...args], {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 32 * 1024 * 1024,
      env: {
        PATH: process.env.PATH ?? '/usr/bin:/bin',
        HOME: process.env.HOME ?? '/tmp',
        GIT_TERMINAL_PROMPT: '0',
        // Proxy/CA settings must pass through in locked-down networks.
        ...(process.env.HTTPS_PROXY ? { HTTPS_PROXY: process.env.HTTPS_PROXY } : {}),
        ...(process.env.https_proxy ? { https_proxy: process.env.https_proxy } : {}),
        ...(process.env.NO_PROXY ? { NO_PROXY: process.env.NO_PROXY } : {}),
        ...(process.env.GIT_SSL_CAINFO ? { GIT_SSL_CAINFO: process.env.GIT_SSL_CAINFO } : {}),
        ...(process.env.SSL_CERT_FILE ? { SSL_CERT_FILE: process.env.SSL_CERT_FILE } : {}),
      },
    });
    return stdout;
  }

  private repoUrl(project: Project): string {
    const r = project.repo!;
    return `https://github.com/${r.owner}/${r.name}.git`;
  }

  /** Fresh workspace for a task mission. */
  async prepareMission(project: Project, missionId: string): Promise<Workspace> {
    const dir = safeJoin(this.root, path.join(project.id, missionId));
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (!project.repo) return { path: dir, hasRepo: false };
    await this.git(this.root, [
      'clone',
      '--depth',
      '50',
      '--branch',
      project.repo.defaultBranch,
      '--single-branch',
      this.repoUrl(project),
      dir,
    ]);
    const branch = `pixel-agency/${missionId}`;
    await this.git(dir, ['checkout', '-b', branch]);
    const baseCommit = (await this.git(dir, ['rev-parse', 'HEAD'])).trim();
    await this.identity(dir);
    return { path: dir, branch, baseCommit, hasRepo: true };
  }

  /** Long-lived workspace for an agent's chat about a project. */
  async prepareChat(project: Project, agentId: string): Promise<Workspace> {
    const dir = safeJoin(this.root, path.join(project.id, `chat-${agentId}`));
    if (!project.repo) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      return { path: dir, hasRepo: false };
    }
    if (fs.existsSync(path.join(dir, '.git'))) {
      // Keep the agent's local edits; just refresh what the remote has.
      await this.git(dir, ['fetch', '--depth', '50', 'origin', project.repo.defaultBranch]).catch(
        () => undefined,
      );
      const baseCommit = (await this.git(dir, ['rev-parse', 'HEAD'])).trim();
      return { path: dir, baseCommit, hasRepo: true };
    }
    const ws = await this.prepareMission(project, `chat-${agentId}`);
    return ws;
  }

  /** Shallow read-only checkout of the default branch (branding, previews). */
  async prepareMirror(project: Project): Promise<Workspace & { commitSha: string }> {
    if (!project.repo) throw new Error('Projeto sem repositório configurado');
    const dir = safeJoin(this.root, path.join(project.id, '_mirror'));
    if (fs.existsSync(path.join(dir, '.git'))) {
      await this.git(dir, ['fetch', '--depth', '1', 'origin', project.repo.defaultBranch]);
      await this.git(dir, ['reset', '--hard', 'FETCH_HEAD']);
    } else {
      fs.rmSync(dir, { recursive: true, force: true });
      await this.git(this.root, [
        'clone',
        '--depth',
        '1',
        '--branch',
        project.repo.defaultBranch,
        '--single-branch',
        this.repoUrl(project),
        dir,
      ]);
    }
    const commitSha = (await this.git(dir, ['rev-parse', 'HEAD'])).trim();
    return { path: dir, hasRepo: true, commitSha };
  }

  private async identity(dir: string): Promise<void> {
    await this.git(dir, ['config', 'user.name', 'PIXEL AGENCY']);
    await this.git(dir, ['config', 'user.email', 'agency@pixel-agency.local']);
  }

  /** Evidence of what the mission changed: `--stat` and a bounded patch. */
  async diff(ws: Workspace, maxPatchBytes = 200_000): Promise<{ stat: string; patch: string }> {
    if (!ws.hasRepo || !ws.baseCommit) return { stat: '', patch: '' };
    // Include untracked files in the diff without staging their contents.
    await this.git(ws.path, ['add', '--intent-to-add', '--all']).catch(() => undefined);
    const stat = await this.git(ws.path, ['diff', '--stat', ws.baseCommit]).catch(() => '');
    let patch = await this.git(ws.path, ['diff', ws.baseCommit]).catch(() => '');
    if (patch.length > maxPatchBytes) patch = patch.slice(0, maxPatchBytes) + '\n… (diff truncado)';
    return { stat: stat.trim(), patch };
  }

  /** Reconstruct a workspace handle from a mission record (for diff after restart). */
  existing(projectId: string, missionId: string, baseCommit?: string, branch?: string): Workspace {
    const dir = safeJoin(this.root, path.join(projectId, missionId));
    return { path: dir, baseCommit, branch, hasRepo: fs.existsSync(path.join(dir, '.git')) };
  }

  remove(projectId: string, missionId: string): void {
    fs.rmSync(safeJoin(this.root, path.join(projectId, missionId)), {
      recursive: true,
      force: true,
    });
  }
}
