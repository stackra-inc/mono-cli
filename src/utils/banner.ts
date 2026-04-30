/**
 * ASCII banner and branding utilities.
 *
 * Displays the Stackra ASCII art with randomized gradient
 * colors on each run for a polished CLI experience.
 *
 * @module utils/banner
 * @since 0.1.0
 */

import chalk from "chalk";

/**
 * Stackra ASCII art lines.
 * Generated from block characters for terminal display.
 */
const BANNER_LINES = [
  " ███████╗████████╗ █████╗  ██████╗██╗  ██╗██████╗  █████╗ ",
  " ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝██╔══██╗██╔══██╗",
  " ███████╗   ██║   ███████║██║     █████╔╝ ██████╔╝███████║",
  " ╚════██║   ██║   ██╔══██║██║     ██╔═██╗ ██╔══██╗██╔══██║",
  " ███████║   ██║   ██║  ██║╚██████╗██║  ██╗██║  ██║██║  ██║",
  " ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝",
];

/**
 * Gradient color themes for the banner.
 * Each theme is an array of ANSI 256-color codes, one per line.
 */
const GRADIENTS: Record<string, number[]> = {
  Ocean: [81, 75, 69, 63, 57, 21],
  Sunset: [214, 208, 202, 196, 160, 124],
  Aurora: [51, 50, 49, 48, 47, 41],
  Ember: [227, 221, 215, 209, 203, 197],
  Cyberpunk: [201, 165, 129, 93, 57, 21],
  Vaporwave: [213, 177, 141, 105, 69, 39],
  Mint: [48, 49, 50, 51, 45, 39],
  Lavender: [183, 177, 171, 165, 129, 93],
};

/**
 * Display the Stackra ASCII banner with a random gradient theme.
 *
 * Picks a random color gradient and applies it line-by-line
 * to the ASCII art for a fresh look on each invocation.
 *
 * @param subtitle - Optional subtitle text below the banner
 */
export function displayBanner(subtitle?: string): void {
  const themeNames = Object.keys(GRADIENTS);
  const themeName = themeNames[Math.floor(Math.random() * themeNames.length)]!;
  const gradient = GRADIENTS[themeName]!;

  console.log("");

  for (let i = 0; i < BANNER_LINES.length; i++) {
    const color = gradient[i % gradient.length];
    console.log(`\x1b[38;5;${color}m${BANNER_LINES[i]}\x1b[0m`);
  }

  if (subtitle) {
    console.log("");
    console.log(chalk.dim(`  ${subtitle}`));
  }

  console.log("");
}

/**
 * Display a compact one-line brand header.
 *
 * Used at the top of command output for quick identification.
 *
 * @param version - CLI version string
 */
export function displayCompactHeader(version: string): void {
  console.log(
    `\n  ${chalk.hex("#818cf8").bold("⬡ Stackra")} ${chalk.dim(`v${version}`)} ${chalk.dim("— Universal Monorepo CLI")}\n`,
  );
}
