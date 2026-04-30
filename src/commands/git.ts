/**
 * Git commands — commit, push, and status across monorepos.
 *
 * Provides multi-repo git operations with interactive commit
 * message prompts and parallel status checks.
 *
 * @module commands/git
 * @since 0.1.0
 *
 * @example
 * ```bash
 * mono git status                          # git status across all repos
 * mono git push "feat: add feature"        # commit + push all repos
 * mono git push --repo=frontend            # push specific repo
 * ```
 */

import * as p from "@clack/prompts";
import {
  discoverMonorepos,
  findWorkspaceRoot,
  runCommand,
  runAcrossReposParallel,
} from "../utils/index.js";
import {
  theme,
  symbols,
  formatDuration,
  printResultsTable,
} from "../utils/ui.js";
import type { GlobalOptions, CommandResult } from "../types/index.js";

/**
 * Show git status across all monorepos.
 *
 * @param opts - Global CLI options
 */
export async function gitStatusCommand(opts: GlobalOptions): Promise<void> {
  const root = findWorkspaceRoot();
  const repos = discoverMonorepos(root);

  const filtered = opts.repo
    ? repos.filter((r) => opts.repo!.some((name) => r.name.includes(name)))
    : repos;

  if (!opts.json) {
    const s = p.spinner();
    s.start("Checking git status...");
    const results = await runAcrossReposParallel(
      "git status --short",
      filtered,
    );
    s.stop("Status checked");

    console.log("");
    for (let i = 0; i < filtered.length; i++) {
      const repo = filtered[i];
      const lines = results[i].stdout.split("\n").filter(Boolean);
      const branch = (
        await runCommand("git branch --show-current", repo.path)
      ).stdout.trim();

      console.log(
        `  ${theme.bold(repo.name.padEnd(25))} ${theme.info(branch.padEnd(15))} ` +
          (lines.length === 0
            ? `${symbols.success} clean`
            : `${symbols.warning} ${lines.length} change${lines.length > 1 ? "s" : ""}`),
      );

      // Show changed files in verbose mode
      if (opts.verbose && lines.length > 0) {
        for (const line of lines.slice(0, 10)) {
          console.log(`    ${theme.dim(line)}`);
        }
        if (lines.length > 10) {
          console.log(`    ${theme.dim(`... and ${lines.length - 10} more`)}`);
        }
      }
    }
    console.log("");
  } else {
    const results = await runAcrossReposParallel(
      "git status --short",
      filtered,
    );
    const branches = await runAcrossReposParallel(
      "git branch --show-current",
      filtered,
    );

    const data = filtered.map((repo, i) => ({
      name: repo.name,
      branch: branches[i].stdout.trim(),
      changes: results[i].stdout.split("\n").filter(Boolean),
      clean: results[i].stdout.trim() === "",
    }));

    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Commit and push changes across monorepos.
 *
 * For each repo with uncommitted changes:
 * 1. Stage all changes (git add -A)
 * 2. Commit with the provided message
 * 3. Push to the current branch
 *
 * @param message - Commit message (prompted interactively if not provided)
 * @param opts - Global CLI options
 */
export async function gitPushCommand(
  message: string | undefined,
  opts: GlobalOptions,
): Promise<void> {
  const root = findWorkspaceRoot();
  const repos = discoverMonorepos(root);

  const filtered = opts.repo
    ? repos.filter((r) => opts.repo!.some((name) => r.name.includes(name)))
    : repos;

  // Check which repos have changes
  const statusResults = await runAcrossReposParallel(
    "git status --short",
    filtered,
  );
  const reposWithChanges = filtered.filter(
    (_, i) => statusResults[i].stdout.trim() !== "",
  );

  if (reposWithChanges.length === 0) {
    if (!opts.json) {
      p.log.info("All repos are clean — nothing to push.");
    } else {
      console.log(JSON.stringify({ message: "All repos clean", pushed: [] }));
    }
    return;
  }

  // Get commit message
  let commitMessage = message;

  if (!commitMessage && opts.interactive) {
    const input = await p.text({
      message: "Commit message:",
      placeholder: "chore: update monorepo configs",
      validate: (value) => {
        if (!value.trim()) return "Commit message is required";
        return undefined;
      },
    });

    if (p.isCancel(input)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }

    commitMessage = input;
  }

  if (!commitMessage) {
    p.log.error(
      'Commit message is required. Use: mono git push "your message"',
    );
    process.exit(1);
  }

  if (!opts.json) {
    p.intro(theme.primary("  Git Push  "));
    p.log.info(`${theme.muted("Message:")} ${commitMessage}`);
    p.log.info(
      `${theme.muted("Repos:")} ${reposWithChanges.map((r) => r.name).join(", ")}`,
    );
  }

  const results: CommandResult[] = [];
  const s = opts.json ? null : p.spinner();

  for (const repo of reposWithChanges) {
    s?.start(`Pushing ${theme.bold(repo.name)}...`);
    const start = Date.now();

    // Stage → Commit → Push
    const stage = await runCommand("git add -A", repo.path);
    if (!stage.success) {
      results.push({ ...stage, repo: repo.name });
      s?.stop(`${symbols.error} ${theme.bold(repo.name)} — staging failed`);
      continue;
    }

    const commit = await runCommand(
      `git commit -m "${commitMessage}" --no-verify`,
      repo.path,
    );
    if (!commit.success) {
      results.push({ ...commit, repo: repo.name });
      s?.stop(`${symbols.error} ${theme.bold(repo.name)} — commit failed`);
      continue;
    }

    const push = await runCommand(
      "git push origin HEAD --no-verify",
      repo.path,
    );
    const duration = Date.now() - start;

    results.push({
      repo: repo.name,
      success: push.success,
      stdout: push.stdout,
      stderr: push.stderr,
      exitCode: push.exitCode,
      duration,
    });

    if (!opts.json) {
      const icon = push.success ? symbols.success : symbols.error;
      s?.stop(
        `${icon} ${theme.bold(repo.name)} ${theme.dim(formatDuration(duration))}`,
      );
    }
  }

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log("");
    printResultsTable(results);

    const allPassed = results.every((r) => r.success);
    p.outro(
      allPassed
        ? theme.success("All repos pushed")
        : theme.error("Some pushes failed"),
    );
  }
}
