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

/** Descarga y hashea los adjuntos que sean imágenes. */
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
      console.warn(`[index] No se pudo descargar/hashear adjunto ${att.name}:`, err);
    }
  }
  return hashes;
}

client.once(Events.ClientReady, (c) => {
  console.log(`[index] Conectado como ${c.user.tag}`);
  console.log(
    `[index] Config: ventana=${config.windowMs}ms, minCanales=${config.minChannels}, ` +
      `umbralImagen=${config.imageHashThreshold}`,
  );
});

client.on(Events.MessageCreate, async (message) => {
  // Ignorar bots, webhooks, mensajes del sistema y DMs.
  if (message.author.bot || message.webhookId) return;
  if (!message.inGuild()) return;

  const normText = normalizeText(message.content);
  const imageHashes = await hashAttachments(message);

  // Sin contenido comparable (ni texto ni imágenes) → nada que hacer.
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
  console.error("[index] Error del cliente Discord:", err);
});

// Cierre limpio para `docker stop` (SIGTERM) y Ctrl-C (SIGINT).
function shutdown(signal: string): void {
  console.log(`[index] Recibido ${signal}, cerrando...`);
  client.destroy();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

client.login(config.token);
