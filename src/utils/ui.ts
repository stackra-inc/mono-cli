/**
 * UI utilities for the CLI.
 *
 * Provides consistent formatting, colors, tables, and output
 * helpers. Respects --json and --no-interactive flags.
 *
 * @module utils/ui
 * @since 1.0.0
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import type { CommandResult, MonorepoInfo, GlobalOptions } from '@/types';

// ============================================================================
// Theme Colors
// ============================================================================

/** Stackra brand colors and semantic colors for consistent output. */
export const theme = {
  /** Primary brand color */
  primary: chalk.hex('#818cf8'),
  /** Success state */
  success: chalk.hex('#22c55e'),
  /** Warning state */
  warning: chalk.hex('#f59e0b'),
  /** Error state */
  error: chalk.hex('#ef4444'),
  /** Muted/secondary text */
  muted: chalk.hex('#6b7280'),
  /** Info/accent */
  info: chalk.hex('#38bdf8'),
  /** Bold white for emphasis */
  bold: chalk.bold.white,
  /** Dim text for less important info */
  dim: chalk.dim,
};

// ============================================================================
// Symbols
// ============================================================================

/** Unicode symbols for consistent status indicators. */
export const symbols = {
  success: theme.success('✔'),
  error: theme.error('✖'),
  warning: theme.warning('⚠'),
  info: theme.info('ℹ'),
  arrow: theme.muted('→'),
  bullet: theme.muted('•'),
  line: theme.muted('─'),
};

// ============================================================================
// Formatters
// ============================================================================

/**
 * Format a duration in milliseconds to a human-readable string.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "1.2s", "350ms")
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Format ecosystem badges for display.
 *
 * @param ecosystems - Array of ecosystem types
 * @returns Colored badge string
 */
export function formatEcosystems(ecosystems: string[]): string {
  const colors: Record<string, (s: string) => string> = {
    node: chalk.hex('#68a063'),
    php: chalk.hex('#777bb4'),
    'react-native': chalk.hex('#61dafb'),
    python: chalk.hex('#3776ab'),
  };

  return ecosystems.map((e) => (colors[e] || chalk.white)(`[${e}]`)).join(' ');
}

// ============================================================================
// Output Helpers
// ============================================================================

/**
 * Print a section header with a horizontal rule.
 *
 * @param title - Section title
 */
export function header(title: string): void {
  console.log('');
  console.log(theme.bold(title));
  console.log(theme.muted('─'.repeat(50)));
}

/**
 * Print a key-value pair.
 *
 * @param key - Label
 * @param value - Value
 */
export function keyValue(key: string, value: string): void {
  console.log(`  ${theme.muted(key.padEnd(18))} ${value}`);
}

/**
 * Print command results as a table.
 *
 * @param results - Array of command results
 */
export function printResultsTable(results: CommandResult[]): void {
  const table = new Table({
    head: [theme.muted('Repo'), theme.muted('Status'), theme.muted('Duration')],
    style: { head: [], border: ['dim'] },
    chars: {
      top: '─',
      'top-mid': '┬',
      'top-left': '┌',
      'top-right': '┐',
      bottom: '─',
      'bottom-mid': '┴',
      'bottom-left': '└',
      'bottom-right': '┘',
      left: '│',
      'left-mid': '├',
      mid: '─',
      'mid-mid': '┼',
      right: '│',
      'right-mid': '┤',
      middle: '│',
    },
  });

  for (const r of results) {
    table.push([
      theme.bold(r.repo),
      r.success ? `${symbols.success} passed` : `${symbols.error} failed`,
      theme.dim(formatDuration(r.duration)),
    ]);
  }

  console.log(table.toString());
}

/**
 * Print monorepo info as a table.
 *
 * @param repos - Array of monorepo info objects
 */
export function printReposTable(repos: MonorepoInfo[]): void {
  const table = new Table({
    head: [
      theme.muted('Repo'),
      theme.muted('Ecosystems'),
      theme.muted('Workspaces'),
      theme.muted('Turbo'),
    ],
    style: { head: [], border: ['dim'] },
    chars: {
      top: '─',
      'top-mid': '┬',
      'top-left': '┌',
      'top-right': '┐',
      bottom: '─',
      'bottom-mid': '┴',
      'bottom-left': '└',
      'bottom-right': '┘',
      left: '│',
      'left-mid': '├',
      mid: '─',
      'mid-mid': '┼',
      right: '│',
      'right-mid': '┤',
      middle: '│',
    },
  });

  for (const r of repos) {
    table.push([
      theme.bold(r.name),
      formatEcosystems(r.ecosystems),
      theme.dim(r.workspaces.join(', ') || '—'),
      r.hasTurbo ? symbols.success : symbols.error,
    ]);
  }

  console.log(table.toString());
}

/**
 * Output data as JSON if --json flag is set, otherwise use the formatter.
 *
 * @param data - Data to output
 * @param opts - Global CLI options
 * @param formatter - Function to format data for human-readable output
 */
export function output<T>(data: T, opts: GlobalOptions, formatter: (data: T) => void): void {
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    formatter(data);
  }
}
