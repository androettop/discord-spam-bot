// Loads variables from .env (if present). Without a .env file it does nothing
// and the process uses the real environment variables. Must run BEFORE importing
// config.ts, which reads process.env at import time.
import "dotenv/config";
import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  Partials,
} from "discord.js";
import { config } from "./config.js";
import { SpamDetector, normalizeText, type MsgRecord } from "./detector.js";
import { hashImage, isHashableImage } from "./imageHash.js";
import { moderateBurst } from "./moderation.js";

const detector = new SpamDetector({
  windowMs: config.windowMs,
  minChannels: config.minChannels,
  imageHashThreshold: config.imageHashThreshold,
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

/** Downloads and hashes the attachments that are images. */
async function hashAttachments(message: Message): Promise<string[]> {
  const hashes: string[] = [];
  for (const att of message.attachments.values()) {
    if (!isHashableImage(att.contentType, att.name)) continue;
    try {
      const res = await fetch(att.url);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      const h = await hashImage(buffer);
      if (h) hashes.push(h);
    } catch (err) {
      console.warn(`[index] Could not download/hash attachment ${att.name}:`, err);
    }
  }
  return hashes;
}

client.once(Events.ClientReady, (c) => {
  console.log(`[index] Connected as ${c.user.tag}`);
  console.log(
    `[index] Config: window=${config.windowMs}ms, minChannels=${config.minChannels}, ` +
      `imageThreshold=${config.imageHashThreshold}`,
  );
});

client.on(Events.MessageCreate, async (message) => {
  // Ignore bots, webhooks, system messages and DMs.
  if (message.author.bot || message.webhookId) return;
  if (!message.inGuild()) return;

  const normText = normalizeText(message.content);
  const imageHashes = await hashAttachments(message);

  // Nothing comparable (neither text nor images) -> nothing to do.
  if (normText === "" && imageHashes.length === 0) return;

  const record: MsgRecord = {
    userId: message.author.id,
    channelId: message.channelId,
    messageId: message.id,
    guildId: message.guildId,
    ts: message.createdTimestamp,
    normText,
    imageHashes,
  };

  const burst = detector.check(record);
  if (burst) {
    await moderateBurst(client, message.member, burst);
  }
});

client.on(Events.Error, (err) => {
  console.error("[index] Discord client error:", err);
});

// Clean shutdown for `docker stop` (SIGTERM) and Ctrl-C (SIGINT).
function shutdown(signal: string): void {
  console.log(`[index] Received ${signal}, shutting down...`);
  client.destroy();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

client.login(config.token);
