import { hammingDistance } from "./imageHash.js";

export type MsgRecord = {
  userId: string;
  channelId: string;
  messageId: string;
  guildId: string;
  ts: number;
  /** Normalized text ('' if the message has no text). */
  normText: string;
  /** pHashes of the attachments that are images. */
  imageHashes: string[];
};

export type DetectorOptions = {
  windowMs: number;
  minChannels: number;
  imageHashThreshold: number;
};

/** Normalizes text: trim, lowercase, and collapse repeated whitespace. */
export function normalizeText(content: string): string {
  return content.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * In-memory cross-channel spam detector.
 *
 * Keeps a sliding window of recent messages per user and decides whether a new
 * message forms a "burst": the same content (normalized text or a perceptually
 * similar image) sent by the same user across >= minChannels distinct channels
 * within windowMs.
 */
export class SpamDetector {
  private records: MsgRecord[] = [];
  /** IDs of messages already handled by a burst, to avoid reprocessing them. */
  private consumed = new Set<string>();

  constructor(private readonly opts: DetectorOptions) {}

  private prune(now: number): void {
    const cutoff = now - this.opts.windowMs;
    this.records = this.records.filter((r) => r.ts >= cutoff);
    // Keep `consumed` from growing unbounded: after pruning, only retain the
    // IDs that are still within the window.
    if (this.consumed.size > 0) {
      const live = new Set(this.records.map((r) => r.messageId));
      for (const id of this.consumed) {
        if (!live.has(id)) this.consumed.delete(id);
      }
    }
  }

  /** Does the content of two records match (text or image)? */
  private matches(a: MsgRecord, b: MsgRecord): boolean {
    if (a.normText !== "" && a.normText === b.normText) return true;
    for (const ha of a.imageHashes) {
      for (const hb of b.imageHashes) {
        if (hammingDistance(ha, hb) <= this.opts.imageHashThreshold) return true;
      }
    }
    return false;
  }

  /**
   * Records the message and returns the detected burst (including the new
   * message) if it triggers the spam condition, or null otherwise.
   */
  check(record: MsgRecord): MsgRecord[] | null {
    this.prune(record.ts);

    // Previous records from the same user with matching content. Includes
    // already-consumed ones: if a late message continues an ongoing burst
    // (same content in another channel), it must be deleted too.
    const matched = this.records.filter(
      (r) => r.userId === record.userId && this.matches(r, record),
    );

    // The new message is always added to the history for future matches.
    this.records.push(record);

    const group = [...matched, record];
    const distinctChannels = new Set(group.map((r) => r.channelId));

    if (distinctChannels.size >= this.opts.minChannels) {
      // It's a burst. Only return (and mark) the messages not yet moderated,
      // so we don't re-delete ones already processed.
      const fresh = group.filter((r) => !this.consumed.has(r.messageId));
      for (const r of fresh) this.consumed.add(r.messageId);
      return fresh.length > 0 ? fresh : null;
    }

    return null;
  }
}
