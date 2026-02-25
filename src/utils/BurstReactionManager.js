'use strict';

/**
 * BurstReactionManager — adds support for Discord "Super Reactions" (Burst Reactions).
 *
 * Super Reactions (burst reactions) are animated reactions available to Nitro users.
 * The Discord API supports them via a `type` query parameter, but discord.js does not
 * expose this parameter in its MessageReaction methods.
 *
 * Discord API Reference: https://discord.com/developers/docs/resources/message#create-reaction
 * Reaction types: 0 = Normal, 1 = Burst (Super Reaction)
 */
class BurstReactionManager {
  /**
   * @param {import('discord.js').Client} client
   */
  constructor(client) {
    if (!client?.rest) {
      throw new Error('[discordjs-plus] BurstReactionManager requires a valid discord.js Client instance.');
    }
    this.client = client;
  }

  /**
   * Adds a burst (super) reaction to a message.
   * Note: This requires the bot account to have Nitro, or it will fail with 403.
   *
   * @param {string} channelId
   * @param {string} messageId
   * @param {string} emoji - URL-encoded emoji (e.g. '⭐' → '%E2%AD%90', or 'name:id' for custom)
   * @returns {Promise<void>}
   *
   * @example
   * await manager.addBurstReaction('channelId', 'messageId', '⭐');
   * await manager.addBurstReaction('channelId', 'messageId', 'customEmoji:123456789');
   */
  async addBurstReaction(channelId, messageId, emoji) {
    if (!channelId || !messageId || !emoji) {
      throw new Error('[discordjs-plus] BurstReactionManager#addBurstReaction: channelId, messageId, and emoji are required.');
    }

    const encodedEmoji = this._encodeEmoji(emoji);

    await this.client.rest.put(
      `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me?type=1`
    );
  }

  /**
   * Adds a normal reaction (type=0) — same as discord.js's message.react() but explicit.
   * @param {string} channelId
   * @param {string} messageId
   * @param {string} emoji
   * @returns {Promise<void>}
   */
  async addNormalReaction(channelId, messageId, emoji) {
    if (!channelId || !messageId || !emoji) {
      throw new Error('[discordjs-plus] BurstReactionManager#addNormalReaction: channelId, messageId, and emoji are required.');
    }

    const encodedEmoji = this._encodeEmoji(emoji);

    await this.client.rest.put(
      `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me?type=0`
    );
  }

  /**
   * Removes a burst reaction from a message.
   * @param {string} channelId
   * @param {string} messageId
   * @param {string} emoji
   * @returns {Promise<void>}
   */
  async removeBurstReaction(channelId, messageId, emoji) {
    if (!channelId || !messageId || !emoji) {
      throw new Error('[discordjs-plus] BurstReactionManager#removeBurstReaction: channelId, messageId, and emoji are required.');
    }

    const encodedEmoji = this._encodeEmoji(emoji);

    await this.client.rest.delete(
      `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me?type=1`
    );
  }

  /**
   * Fetches users who reacted with a specific reaction type.
   *
   * @param {string} channelId
   * @param {string} messageId
   * @param {string} emoji
   * @param {0|1} type - 0 = Normal, 1 = Burst
   * @param {{ limit?: number, after?: string }} [options]
   * @returns {Promise<Object[]>} Array of user objects
   *
   * @example
   * // Get all users who burst-reacted with ⭐
   * const burstVoters = await manager.getReactions('ch', 'msg', '⭐', 1);
   * // Get users who normal-reacted
   * const normalVoters = await manager.getReactions('ch', 'msg', '⭐', 0);
   */
  async getReactions(channelId, messageId, emoji, type = 0, options = {}) {
    if (!channelId || !messageId || !emoji) {
      throw new Error('[discordjs-plus] BurstReactionManager#getReactions: channelId, messageId, and emoji are required.');
    }

    const encodedEmoji = this._encodeEmoji(emoji);
    const params = new URLSearchParams({ type: String(type) });
    if (options.limit) params.set('limit', String(Math.min(options.limit, 100)));
    if (options.after) params.set('after', options.after);

    return this.client.rest.get(
      `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}?${params}`
    );
  }

  /**
   * Gets a summary of all reactions on a message, separated by type.
   * @param {string} channelId
   * @param {string} messageId
   * @returns {Promise<ReactionSummary>}
   */
  async getSummary(channelId, messageId) {
    const message = await this.client.rest.get(
      `/channels/${channelId}/messages/${messageId}`
    );

    const summary = {};
    for (const reaction of message.reactions ?? []) {
      const key = reaction.emoji.id
        ? `${reaction.emoji.name}:${reaction.emoji.id}`
        : reaction.emoji.name;

      summary[key] = {
        emoji: reaction.emoji,
        normal: reaction.count_details?.normal ?? reaction.count ?? 0,
        burst: reaction.count_details?.burst ?? 0,
        total: reaction.count ?? 0,
        meReacted: reaction.me ?? false,
        meBurst: reaction.me_burst ?? false,
        burstColors: reaction.burst_colors ?? [],
      };
    }

    return summary;
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /** @private */
  _encodeEmoji(emoji) {
    // If it's a unicode emoji, URL-encode it
    if (!/^\w+:\d+$/.test(emoji) && !emoji.includes(':')) {
      return encodeURIComponent(emoji);
    }
    // Custom emoji format: "name:id" → already valid
    return emoji;
  }
}

module.exports = { BurstReactionManager };

/**
 * @typedef {Object} ReactionSummary
 * @description Key is either "emojiName" or "emojiName:emojiId"
 * @type {Object.<string, {
 *   emoji: Object,
 *   normal: number,
 *   burst: number,
 *   total: number,
 *   meReacted: boolean,
 *   meBurst: boolean,
 *   burstColors: string[]
 * }>}
 */
