function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    console.error(`[config] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value.trim();
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    console.error(`[config] ${name} is not a valid number: "${raw}"`);
    process.exit(1);
  }
  return parsed;
}

export const config = {
  /** Discord bot token. */
  token: required("DISCORD_TOKEN"),
  /** ID of the existing "Muted" role in the server. */
  mutedRoleId: required("MUTED_ROLE_ID"),
  /** Detection window in milliseconds. */
  windowMs: num("WINDOW_MS", 5000),
  /** Minimum number of distinct channels to count as spam. */
  minChannels: num("MIN_CHANNELS", 2),
  /** Max Hamming distance between pHashes to treat two images as equal (0-64). */
  imageHashThreshold: num("IMAGE_HASH_THRESHOLD", 6),
} as const;
