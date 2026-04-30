/**
 * Command runner utilities.
 *
 * Provides helpers for executing shell commands across monorepos
 * with proper error handling, timing, and output capture.
 *
 * @module utils/runner
 * @since 0.1.0
 */

import { execa, type Options as ExecaOptions } from "execa";
import type { CommandResult, MonorepoInfo } from "@/types";

/**
 * Run a shell command in a specific directory.
 *
 * Captures stdout/stderr, measures duration, and returns
 * a structured result object.
 *
 * @param command - The command to run (e.g., 'pnpm build')
 * @param cwd - Working directory for the command
 * @param options - Additional execa options
 * @returns Structured command result
 */
export async function runCommand(
  command: string,
  cwd: string,
  options?: ExecaOptions,
): Promise<CommandResult> {
  const start = Date.now();
  const parts = command.split(" ");
  const cmd = parts[0]!;
  const args = parts.slice(1);

  try {
    const result = await execa(cmd, args, {
      cwd,
      shell: true,
      reject: false,
      ...options,
    });

    return {
      repo: cwd,
      success: result.exitCode === 0,
      stdout: String(result.stdout ?? ""),
      stderr: String(result.stderr ?? ""),
      exitCode: result.exitCode ?? 0,
      duration: Date.now() - start,
    };
  } catch (error: any) {
    return {
      repo: cwd,
      success: false,
      stdout: "",
      stderr: error.message || String(error),
      exitCode: 1,
      duration: Date.now() - start,
    };
  }
}

/**
 * Run a command across multiple monorepos sequentially.
 *
 * Executes the command in each repo one at a time, collecting
 * results. Use this when commands might conflict if run in parallel.
 *
 * @param command - The command to run
 * @param repos - Array of monorepo info objects
 * @param onProgress - Optional callback for progress updates
 * @returns Array of command results
 */
export async function runAcrossRepos(
  command: string,
  repos: MonorepoInfo[],
  onProgress?: (repo: MonorepoInfo, index: number, total: number) => void,
): Promise<CommandResult[]> {
  const results: CommandResult[] = [];

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i]!;
    onProgress?.(repo, i, repos.length);

    const result = await runCommand(command, repo.path);
    results.push({ ...result, repo: repo.name });
  }

  return results;
}

/**
 * Run a command across multiple monorepos in parallel.
 *
 * Executes the command in all repos simultaneously.
 * Use this for read-only operations like status checks.
 *
 * @param command - The command to run
 * @param repos - Array of monorepo info objects
 * @returns Array of command results
 */
export async function runAcrossReposParallel(
  command: string,
  repos: MonorepoInfo[],
): Promise<CommandResult[]> {
  const promises = repos.map(async (repo) => {
    const result = await runCommand(command, repo.path);
    return { ...result, repo: repo.name };
  });

  return Promise.all(promises);
}
