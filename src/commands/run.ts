/**
 * Run command — execute turbo tasks across monorepos.
 *
 * Wraps `turbo run <task>` with multi-repo support, progress
 * indicators, and structured output.
 *
 * @module commands/run
 * @since 0.1.0
 *
 * @example
 * ```bash
 * mono run build                    # build all repos
 * mono run lint --repo=frontend     # lint frontend only
 * mono run test --json              # JSON output
 * mono run dev --repo=php           # dev server for PHP
 * ```
 */

import * as p from "@clack/prompts";
import {
  discoverMonorepos,
  findWorkspaceRoot,
  runCommand,
} from "../utils/index.js";
import {
  theme,
  symbols,
  formatDuration,
  printResultsTable,
} from "../utils/ui.js";
import type { GlobalOptions, CommandResult } from "../types/index.js";

/**
 * Execute a turbo task across monorepos.
 *
 * @param task - The turbo task to run (build, lint, test, etc.)
 * @param opts - Global CLI options
 * @param extraArgs - Additional arguments to pass to turbo
 */
export async function runTaskCommand(
  task: string,
  opts: GlobalOptions,
  extraArgs: string[] = [],
): Promise<void> {
  const root = findWorkspaceRoot();
  const repos = discoverMonorepos(root);

  const filtered = opts.repo
    ? repos.filter((r) => opts.repo!.some((name) => r.name.includes(name)))
    : repos;

  if (filtered.length === 0) {
    p.log.warn("No matching repos found.");
    return;
  }

  const turboArgs = extraArgs.length > 0 ? ` ${extraArgs.join(" ")}` : "";
  const command = `pnpm turbo run ${task}${turboArgs}`;

  if (!opts.json) {
    p.intro(theme.primary(`  Run: ${task}  `));
    p.log.info(`${theme.muted("Command:")} ${command}`);
    p.log.info(
      `${theme.muted("Repos:")} ${filtered.map((r) => r.name).join(", ")}`,
    );
  }

  const results: CommandResult[] = [];
  const s = opts.json ? null : p.spinner();

  for (let i = 0; i < filtered.length; i++) {
    const repo = filtered[i];
    s?.start(
      `Running ${theme.bold(task)} in ${theme.bold(repo.name)} (${i + 1}/${filtered.length})...`,
    );

    const result = await runCommand(command, repo.path);
    results.push({ ...result, repo: repo.name });

    if (!opts.json) {
      const icon = result.success ? symbols.success : symbols.error;
      s?.stop(
        `${icon} ${theme.bold(repo.name)} ${theme.dim(formatDuration(result.duration))}`,
      );

      // Show stderr for failures in verbose mode
      if (!result.success && opts.verbose) {
        console.log(theme.error(result.stderr.slice(-500)));
      }
    }
  }

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log("");
    printResultsTable(results);

    const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
    const passed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    p.outro(
      failed === 0
        ? theme.success(
            `${passed} repo${passed > 1 ? "s" : ""} passed ${theme.dim(`(${formatDuration(totalTime)})`)}`,
          )
        : theme.error(
            `${failed} failed, ${passed} passed ${theme.dim(`(${formatDuration(totalTime)})`)}`,
          ),
    );

    if (failed > 0) process.exit(1);
  }
}
