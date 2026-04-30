/**
 * Repo alias utilities.
 *
 * Generates short aliases for monorepo names to use in
 * custom command namespacing (e.g., `fe:build` instead of
 * `frontend-monorepo:build`).
 *
 * @module utils/repo-alias
 * @since 1.0.0
 */

/**
 * Common monorepo name → short alias mappings.
 * Falls back to first 2-3 chars if no match.
 */
const ALIAS_MAP: Record<string, string> = {
  'frontend-monorepo': 'fe',
  'php-monorepo': 'php',
  'react-native-monorepo': 'rn',
  'backend-monorepo': 'be',
  'mobile-monorepo': 'mob',
  'mono-cli': 'cli',
};

/**
 * Get a short alias for a monorepo name.
 *
 * Checks the alias map first, then falls back to extracting
 * the first meaningful part of the name.
 *
 * @param repoName - Full monorepo directory name
 * @returns Short alias (e.g., "fe", "php", "rn")
 */
export function getRepoAlias(repoName: string): string {
  // Check explicit mapping
  if (ALIAS_MAP[repoName]) {
    return ALIAS_MAP[repoName];
  }

  // Try the config name (from mono.config.mjs)
  // This is handled by the caller

  // Fallback: strip -monorepo suffix and take first part
  const cleaned = repoName.replace(/-monorepo$/, '').replace(/-mono$/, '');

  // If it's short enough, use as-is
  if (cleaned.length <= 4) return cleaned;

  // Take first 3 chars
  return cleaned.slice(0, 3);
}
