import {
  Client,
  DiscordAPIError,
  GuildMember,
  TextBasedChannel,
} from "discord.js";
import type { MsgRecord } from "./detector.js";
import { config } from "./config.js";

/**
 * Aplica la moderación sobre un brote detectado: asigna el rol "Silenciado"
 * al autor y borra todos los mensajes involucrados.
 */
export async function moderateBurst(
  client: Client,
  member: GuildMember | null,
  burst: MsgRecord[],
): Promise<void> {
  const userId = burst[0]?.userId ?? "desconocido";
  const channels = new Set(burst.map((r) => r.channelId));

  console.warn(
    `[mod] Spam detectado de ${userId} en ${channels.size} canales ` +
      `(${burst.length} mensajes). Aplicando rol y borrando.`,
  );

  await assignMutedRole(member, userId);
  await deleteMessages(client, burst);
}

async function assignMutedRole(
  member: GuildMember | null,
  userId: string,
): Promise<void> {
  if (!member) {
    console.warn(`[mod] No se pudo obtener el member de ${userId}; no se asigna rol.`);
    return;
  }
  if (member.roles.cache.has(config.mutedRoleId)) return; // ya silenciado

  try {
    await member.roles.add(config.mutedRoleId, "Spam cross-canal detectado");
    console.warn(`[mod] Rol "Silenciado" asignado a ${userId}.`);
  } catch (err) {
    if (err instanceof DiscordAPIError) {
      console.error(
        `[mod] No se pudo asignar el rol a ${userId} (¿permisos/jerarquía?): ` +
          `${err.code} ${err.message}`,
      );
    } else {
      console.error(`[mod] Error inesperado asignando rol a ${userId}:`, err);
    }
  }
}

async function deleteMessages(client: Client, burst: MsgRecord[]): Promise<void> {
  await Promise.all(
    burst.map(async (r) => {
      try {
        const channel = await client.channels.fetch(r.channelId);
        if (!channel || !channel.isTextBased()) return;
        await (channel as TextBasedChannel).messages.delete(r.messageId);
      } catch (err) {
        // 10008 = Unknown Message (ya borrado). Se ignora silenciosamente.
        if (err instanceof DiscordAPIError && err.code === 10008) return;
        console.error(`[mod] No se pudo borrar el mensaje ${r.messageId}:`, err);
      }
    }),
  );
}
