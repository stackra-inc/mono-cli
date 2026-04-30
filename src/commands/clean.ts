/**
 * Clean command — remove build artifacts, caches, and dependencies.
 *
 * Runs the universal cleanup script across all (or selected) monorepos.
 * Supports interactive mode selection and --json output.
 *
 * @module commands/clean
 * @since 0.1.0
 *
 * @example
 * ```bash
 * mono clean                    # interactive mode picker
 * mono clean build              # clean build artifacts
 * mono clean all                # clean everything
 * mono clean deps --repo=php    # clean deps in PHP repo only
 * mono clean --json             # JSON output
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
import type {
  CleanMode,
  GlobalOptions,
  CommandResult,
} from "../types/index.js";

/** Valid cleanup modes with descriptions. */
const CLEAN_MODES: Record<CleanMode, string> = {
  build: "Build artifacts (dist, coverage, .next, vendor/public/build)",
  cache: "Caches (turbo, eslint, tsbuildinfo, bootstrap/cache)",
  deps: "Dependencies (node_modules, vendor, lockfiles)",
  tmp: "Temp files (.DS_Store, Thumbs.db, .tmp)",
  all: "Everything (build + cache + tmp + deps)",
};

/**
 * Execute the clean command.
 *
 * @param mode - Cleanup mode (build, cache, deps, tmp, all)
 * @param opts - Global CLI options
 */
export async function cleanCommand(
  mode: string | undefined,
  opts: GlobalOptions,
): Promise<void> {
  const root = findWorkspaceRoot();
  const repos = discoverMonorepos(root);

  // Filter by --repo if specified
  const filtered = opts.repo
    ? repos.filter((r) => opts.repo!.some((name) => r.name.includes(name)))
    : repos;

  // Interactive mode selection if not provided
  let cleanMode: CleanMode;

  if (mode && mode in CLEAN_MODES) {
    cleanMode = mode as CleanMode;
  } else if (opts.interactive) {
    const selected = await p.select({
      message: "What do you want to clean?",
      options: Object.entries(CLEAN_MODES).map(([value, label]) => ({
        value: value as CleanMode,
        label: `${value.padEnd(8)} ${theme.muted(`— ${label}`)}`,
      })),
    });

    if (p.isCancel(selected)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }

    cleanMode = selected;
  } else {
    cleanMode = "build";
  }

  if (!opts.json) {
    p.intro(theme.primary(`  Clean: ${cleanMode}  `));
    p.log.info(
      `${theme.muted("Repos:")} ${filtered.map((r) => r.name).join(", ")}`,
    );
  }

  // Run cleanup in each repo
  const results: CommandResult[] = [];
  const s = opts.json ? null : p.spinner();

  for (let i = 0; i < filtered.length; i++) {
    const repo = filtered[i];
    s?.start(
      `Cleaning ${theme.bold(repo.name)} (${i + 1}/${filtered.length})...`,
    );

    const result = await runCommand(
      `./scripts/cleanup.sh ${cleanMode}`,
      repo.path,
    );
    results.push({ ...result, repo: repo.name });

    if (!opts.json) {
      const icon = result.success ? symbols.success : symbols.error;
      s?.stop(
        `${icon} ${theme.bold(repo.name)} ${theme.dim(formatDuration(result.duration))}`,
      );
    }
  }

  // Output results
  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log("");
    printResultsTable(results);

    const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
    const allPassed = results.every((r) => r.success);

    p.outro(
      allPassed
        ? theme.success(
            `All clean ${theme.dim(`(${formatDuration(totalTime)})`)}`,
          )
        : theme.error("Some repos failed — check output above"),
    );
  }
}
