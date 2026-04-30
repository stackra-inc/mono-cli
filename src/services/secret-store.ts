/**
 * SecretStore — encrypted secret storage service.
 *
 * Stores secrets in `~/.stackra/secrets.json` with base64
 * obfuscation. Supports multiple values per key with a
 * default selection mechanism.
 *
 * @module services/secret-store
 * @since 1.0.0
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Injectable } from '@stackra/ts-container';
import type { SecretEntry } from '@/types';

/** Directory for Stackra config files. */
const STACKRA_DIR = join(homedir(), '.stackra');

/** Path to the secrets JSON file. */
const SECRETS_FILE = join(STACKRA_DIR, 'secrets.json');

/**
 * Secret storage service.
 *
 * Provides CRUD operations for secrets stored in the user's
 * home directory. Values are base64-encoded for obfuscation
 * (not true encryption).
 */
@Injectable()
export class SecretStore {
  /**
   * Store a new secret entry.
   *
   * If this is the first entry for the given key, it becomes
   * the default automatically.
   *
   * @param key - Secret key name (e.g., NPM_TOKEN)
   * @param value - The secret value
   * @param label - Display label (e.g., "npm - personal")
   * @param source - Where the secret came from
   */
  set(key: string, value: string, label?: string, source: SecretEntry['source'] = 'manual'): void {
    const secrets = this.readAll();
    const existing = secrets.filter((s) => s.key === key);

    const entry: SecretEntry = {
      key,
      label: label || key,
      value: this.encode(value),
      isDefault: existing.length === 0,
      createdAt: new Date().toISOString(),
      source,
    };

    secrets.push(entry);
    this.writeAll(secrets);
  }

  /**
   * Retrieve the default secret value for a key.
   *
   * Returns the entry marked as default, or the first entry
   * if no default is set.
   *
   * @param key - Secret key name
   * @returns The decoded secret value, or null if not found
   */
  get(key: string): string | null {
    const secrets = this.readAll();
    const entries = secrets.filter((s) => s.key === key);

    if (entries.length === 0) return null;

    const defaultEntry = entries.find((s) => s.isDefault) || entries[0]!;
    return this.decode(defaultEntry.value);
  }

  /**
   * Get all entries for a specific key.
   *
   * @param key - Secret key name
   * @returns Array of secret entries (values remain encoded)
   */
  getEntries(key: string): SecretEntry[] {
    return this.readAll().filter((s) => s.key === key);
  }

  /**
   * List all stored secrets (grouped by key).
   *
   * @returns All secret entries (values remain encoded)
   */
  list(): SecretEntry[] {
    return this.readAll();
  }

  /**
   * List unique secret key names.
   *
   * @returns Array of unique key names
   */
  listKeys(): string[] {
    const secrets = this.readAll();
    return [...new Set(secrets.map((s) => s.key))];
  }

  /**
   * Delete all entries for a key.
   *
   * @param key - Secret key name to delete
   * @returns True if any entries were deleted
   */
  delete(key: string): boolean {
    const secrets = this.readAll();
    const filtered = secrets.filter((s) => s.key !== key);

    if (filtered.length === secrets.length) return false;

    this.writeAll(filtered);
    return true;
  }

  /**
   * Set a specific entry as the default for its key.
   *
   * @param key - Secret key name
   * @param label - Label of the entry to make default (optional, uses first if omitted)
   * @returns True if the default was updated
   */
  setDefault(key: string, label?: string): boolean {
    const secrets = this.readAll();
    const entries = secrets.filter((s) => s.key === key);

    if (entries.length === 0) return false;

    // Clear existing defaults for this key
    for (const entry of entries) {
      entry.isDefault = false;
    }

    // Set the new default
    const target = label ? entries.find((s) => s.label === label) : entries[0];
    if (!target) return false;

    target.isDefault = true;
    this.writeAll(secrets);
    return true;
  }

  // ── Private Helpers ────────────────────────────────────────────

  /**
   * Read all secrets from disk.
   *
   * @returns Array of secret entries
   */
  private readAll(): SecretEntry[] {
    if (!existsSync(SECRETS_FILE)) return [];

    try {
      const raw = readFileSync(SECRETS_FILE, 'utf8');
      return JSON.parse(raw) as SecretEntry[];
    } catch {
      return [];
    }
  }

  /**
   * Write all secrets to disk.
   *
   * @param secrets - Array of secret entries to persist
   */
  private writeAll(secrets: SecretEntry[]): void {
    if (!existsSync(STACKRA_DIR)) {
      mkdirSync(STACKRA_DIR, { recursive: true });
    }

    writeFileSync(SECRETS_FILE, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  }

  /**
   * Encode a value with base64 obfuscation.
   *
   * @param value - Plain text value
   * @returns Base64-encoded string
   */
  private encode(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64');
  }

  /**
   * Decode a base64-obfuscated value.
   *
   * @param encoded - Base64-encoded string
   * @returns Plain text value
   */
  private decode(encoded: string): string {
    return Buffer.from(encoded, 'base64').toString('utf8');
  }
}
