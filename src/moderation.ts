import {
  Client,
  DiscordAPIError,
  GuildMember,
  TextBasedChannel,
} from "discord.js";
import type { MsgRecord } from "./detector.js";
import { config } from "./config.js";

/**
 * Applies moderation to a detected burst: assigns the "Muted" role to the
 * author and deletes all involved messages.
 */
export async function moderateBurst(
  client: Client,
  member: GuildMember | null,
  burst: MsgRecord[],
): Promise<void> {
  const userId = burst[0]?.userId ?? "unknown";
  const channels = new Set(burst.map((r) => r.channelId));

  console.warn(
    `[mod] Spam detected from ${userId} across ${channels.size} channels ` +
      `(${burst.length} messages). Applying role and deleting.`,
  );

  await assignMutedRole(member, userId);
  await deleteMessages(client, burst);
}

async function assignMutedRole(
  member: GuildMember | null,
  userId: string,
): Promise<void> {
  if (!member) {
    console.warn(`[mod] Could not resolve member ${userId}; role not assigned.`);
    return;
  }
  if (member.roles.cache.has(config.mutedRoleId)) return; // already muted

  try {
    await member.roles.add(config.mutedRoleId, "Cross-channel spam detected");
    console.warn(`[mod] "Muted" role assigned to ${userId}.`);
  } catch (err) {
    if (err instanceof DiscordAPIError) {
      console.error(
        `[mod] Could not assign role to ${userId} (permissions/hierarchy?): ` +
          `${err.code} ${err.message}`,
      );
    } else {
      console.error(`[mod] Unexpected error assigning role to ${userId}:`, err);
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
        // 10008 = Unknown Message (already deleted). Silently ignored.
        if (err instanceof DiscordAPIError && err.code === 10008) return;
        console.error(`[mod] Could not delete message ${r.messageId}:`, err);
      }
    }),
  );
}
