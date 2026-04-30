/**
 * Platform command mapping and emoji constants.
 *
 * @module config/platforms
 * @since 1.0.0
 */

import type { Ecosystem } from '@/types';

/**
 * Emoji mappings for ecosystems.
 */
export const ECOSYSTEM_EMOJI: Record<Ecosystem, string> = {
  node: '🇹🇸',
  php: '🐘',
  'react-native': '📱',
  python: '🐍',
  go: '🦫',
};

/**
 * Emoji mappings for common tasks.
 */
export const TASK_EMOJI: Record<string, string> = {
  build: '🔨',
  test: '🧪',
  lint: '🔍',
  format: '✨',
  dev: '🚀',
  clean: '🧹',
  status: '📊',
  graph: '🕸️',
  deploy: '🚢',
  publish: '📦',
};
