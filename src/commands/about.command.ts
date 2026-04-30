/**
 * AboutCommand — display CLI info, banner, and registered commands.
 *
 * Shows the ASCII banner, version, detected monorepos,
 * and all registered commands grouped by category.
 *
 * @module commands/about
 * @since 1.0.0
 */

import chalk from "chalk";
import { Injectable } from "@stackra/ts-container";

import { Command } from "@/decorators";
import { BaseCommand } from "./base.command";
import { displayBanner } from "@/utils/banner";
import { discoverMonorepos, findWorkspaceRoot } from "@/utils";
import { theme, formatEcosystems, keyValue, header } from "@/utils/ui";
import { ECOSYSTEM_EMOJI } from "@/config/platforms";
import type { GlobalOptions } from "@/types";

/**
 * About command — shows CLI info and all registered commands.
 */
@Command({
  name: "about",
  description: "Show CLI info, version, and registered commands",
  emoji: "ℹ️",
  category: "core",
})
@Injectable()
export class AboutCommand extends BaseCommand {
  /**
   * Execute the about command.
   *
   * @param args - Unused
   * @param opts - Global CLI options
   */
  async handle(_args: string[], opts: GlobalOptions): Promise<void> {
    const root = findWorkspaceRoot();
    const repos = discoverMonorepos(root);

    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            name: "@stackra/mono-cli",
            version: "1.0.0",
            root,
            repos: repos.map((r) => ({
              name: r.name,
              ecosystems: r.ecosystems,
              hasTurbo: r.hasTurbo,
            })),
          },
          null,
          2,
        ),
      );
      return;
    }

    // 🎨 Banner
    displayBanner("v1.0.0 — Universal Monorepo CLI");

    // 📊 Workspace
    header("📊 Workspace");
    keyValue("Root", root);
    keyValue("Monorepos", String(repos.length));
    keyValue("Node", process.version);

    // 📦 Monorepos
    header("📦 Monorepos");
    for (const repo of repos) {
      const emojis = repo.ecosystems
        .map((e) => ECOSYSTEM_EMOJI[e] || "")
        .join(" ");
      console.log(
        `  ${emojis} ${theme.bold(repo.name.padEnd(25))} ${formatEcosystems(repo.ecosystems)}`,
      );
    }

    // 🔧 Commands
    header("🔧 Commands");
    const commands = [
      ["📊", "mono status", "Show workspace overview"],
      ["🧹", "mono clean [mode]", "Clean artifacts, caches, deps"],
      ["🔨", "mono build", "Build all repos via turbo"],
      ["🔍", "mono lint", "Lint all repos via turbo"],
      ["🧪", "mono test", "Test all repos via turbo"],
      ["🚀", "mono dev", "Start dev servers via turbo"],
      ["✨", "mono format", "Format code with prettier"],
      ["📊", "mono git status", "Git status across repos"],
      ["📤", "mono git push [msg]", "Commit + push all repos"],
      ["🕸️", "mono graph", "Generate dependency graphs"],
      ["ℹ️", "mono about", "This screen"],
    ];

    for (const [emoji, cmd, desc] of commands) {
      console.log(
        `  ${emoji} ${theme.info((cmd ?? "").padEnd(25))} ${theme.muted(desc ?? "")}`,
      );
    }

    // 🎛️ Flags
    header("🎛️  Flags");
    const flags = [
      ["--json", "Output as JSON (for CI/piping)"],
      ["--no-interactive", "Disable prompts (for CI)"],
      ["-r, --repo <name>", "Target specific repo(s)"],
      ["--verbose", "Show detailed output"],
    ];

    for (const [flag, desc] of flags) {
      console.log(
        `  ${theme.info((flag ?? "").padEnd(25))} ${theme.muted(desc ?? "")}`,
      );
    }

    console.log("");
    console.log(
      `  ${chalk.dim("Docs:")} ${chalk.underline("https://github.com/stackra-inc/mono-cli")}`,
    );
    console.log("");
  }
}
