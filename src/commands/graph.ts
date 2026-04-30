/**
 * Graph command — generate dependency graphs for monorepos.
 *
 * Generates HTML, Mermaid, or JSON dependency graphs by running
 * the graph scripts in each monorepo.
 *
 * @module commands/graph
 * @since 0.1.0
 *
 * @example
 * ```bash
 * mono graph                    # generate HTML graphs for all repos
 * mono graph --format=mermaid   # generate Mermaid diagrams
 * mono graph --repo=frontend    # graph specific repo
 * ```
 */

import * as p from "@clack/prompts";
import {
  discoverMonorepos,
  findWorkspaceRoot,
  runCommand,
} from "../utils/index.js";
import { theme, symbols, formatDuration } from "../utils/ui.js";
import type { GlobalOptions } from "../types/index.js";

/**
 * Execute the graph command.
 *
 * @param format - Output format (html, mermaid, json, dot)
 * @param opts - Global CLI options
 */
export async function graphCommand(
  format: string = "html",
  opts: GlobalOptions,
): Promise<void> {
  const root = findWorkspaceRoot();
  const repos = discoverMonorepos(root);

  const filtered = opts.repo
    ? repos.filter((r) => opts.repo!.some((name) => r.name.includes(name)))
    : repos;

  /** Map format to the npm script name. */
  const scriptMap: Record<string, string> = {
    html: "graph",
    mermaid: "graph:mermaid",
    json: "graph:json",
    dot: "graph:dot",
    turbo: "graph:turbo",
  };

  const script = scriptMap[format] || "graph";

  if (!opts.json) {
    p.intro(theme.primary(`  Graph: ${format}  `));
  }

  const s = opts.json ? null : p.spinner();

  for (const repo of filtered) {
    s?.start(`Generating ${format} graph for ${theme.bold(repo.name)}...`);

    const result = await runCommand(`pnpm ${script}`, repo.path);

    if (!opts.json) {
      const icon = result.success ? symbols.success : symbols.warning;
      s?.stop(
        `${icon} ${theme.bold(repo.name)} ${theme.dim(formatDuration(result.duration))}`,
      );

      if (!result.success) {
        p.log.warn(`${repo.name}: graph script not found or failed`);
      }
    }
  }

  if (!opts.json) {
    p.outro(theme.success("Graphs generated"));
  }
}
