/**
 * Status command — show workspace overview.
 *
 * Discovers all monorepos, shows their ecosystems, git status,
 * and workspace package counts. The default command when running
 * `mono` with no arguments.
 *
 * @module commands/status
 * @since 0.1.0
 *
 * @example
 * ```bash
 * mono status              # interactive table
 * mono status --json       # JSON output for CI
 * mono status --repo=php   # filter to specific repo
 * ```
 */

import * as p from "@clack/prompts";
import {
  discoverMonorepos,
  findWorkspaceRoot,
  runAcrossReposParallel,
} from "../utils/index.js";
import {
  theme,
  symbols,
  formatEcosystems,
  formatDuration,
  printReposTable,
  output,
} from "../utils/ui.js";
import type { GlobalOptions, MonorepoInfo } from "../types/index.js";

/**
 * Execute the status command.
 *
 * @param opts - Global CLI options
 */
export async function statusCommand(opts: GlobalOptions): Promise<void> {
  const root = findWorkspaceRoot();
  const repos = discoverMonorepos(root);

  if (repos.length === 0) {
    p.log.warn("No monorepos found in the workspace.");
    return;
  }

  // Filter by --repo if specified
  const filtered = opts.repo
    ? repos.filter((r) => opts.repo!.some((name) => r.name.includes(name)))
    : repos;

  if (opts.json) {
    // JSON mode — include git status
    const gitResults = await runAcrossReposParallel(
      "git status --short",
      filtered,
    );
    const data = filtered.map((repo, i) => ({
      ...repo,
      gitChanges: gitResults[i].stdout.split("\n").filter(Boolean).length,
    }));
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Interactive mode
  p.intro(theme.primary("  Stackra Workspace  "));

  p.log.info(`${theme.muted("Root:")} ${root}`);
  p.log.info(
    `${theme.muted("Repos:")} ${filtered.length} monorepos discovered`,
  );

  console.log("");
  printReposTable(filtered);

  // Git status summary
  const s = p.spinner();
  s.start("Checking git status...");

  const gitResults = await runAcrossReposParallel(
    "git status --short",
    filtered,
  );

  s.stop("Git status checked");

  console.log("");
  for (let i = 0; i < filtered.length; i++) {
    const repo = filtered[i];
    const changes = gitResults[i].stdout.split("\n").filter(Boolean).length;
    const status =
      changes === 0
        ? `${symbols.success} clean`
        : `${symbols.warning} ${changes} uncommitted change${changes > 1 ? "s" : ""}`;

    console.log(`  ${theme.bold(repo.name.padEnd(25))} ${status}`);
  }

  p.outro(theme.muted("Run `mono --help` for available commands"));
}
