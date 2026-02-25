'use strict';

/**
 * Provides extended utilities for managing Forum Channel tags.
 * discord.js v14 requires you to re-send the entire tag array when editing,
 * which is error-prone. This manager provides atomic add/remove/edit operations.
 *
 * BUG FIXED: discord.js forum tag editing replaces ALL tags — forgetting to
 * re-include existing tags deletes them silently.
 */
class ForumTagManager {
  /**
   * @param {import('discord.js').Client} client
   */
  constructor(client) {
    if (!client?.rest) {
      throw new Error('[discordjs-plus] ForumTagManager requires a valid discord.js Client instance.');
    }
    this.client = client;
  }

  /**
   * Fetches all tags from a forum channel.
   * @param {string} channelId
   * @returns {Promise<ForumTag[]>}
   */
  async fetchAll(channelId) {
    if (!channelId) throw new Error('[discordjs-plus] ForumTagManager#fetchAll: channelId is required.');
    const channel = await this.client.rest.get(`/channels/${channelId}`);
    return channel.available_tags ?? [];
  }

  /**
   * Adds a new tag to a forum channel WITHOUT overwriting existing tags.
   * Fixes the discord.js gotcha where editing tags replaces the entire array.
   *
   * @param {string} channelId
   * @param {CreateTagData} tagData
   * @returns {Promise<ForumTag[]>} Updated list of tags
   *
   * @example
   * await manager.addTag('forumChannelId', {
   *   name: 'Bug Report',
   *   emojiName: '🐛',
   *   moderated: false
   * });
   */
  async addTag(channelId, tagData) {
    if (!channelId) throw new Error('[discordjs-plus] ForumTagManager#addTag: channelId is required.');
    if (!tagData?.name) throw new Error('[discordjs-plus] ForumTagManager#addTag: tagData.name is required.');

    const existingTags = await this.fetchAll(channelId);

    if (existingTags.length >= 20) {
      throw new Error('[discordjs-plus] ForumTagManager#addTag: Forum channels cannot have more than 20 tags.');
    }

    const newTag = this._buildTag(tagData);
    const updatedTags = [...existingTags, newTag];

    const channel = await this.client.rest.patch(`/channels/${channelId}`, {
      body: { available_tags: updatedTags },
    });

    return channel.available_tags ?? [];
  }

  /**
   * Removes a tag from a forum channel by its ID.
   * Safe: will not affect other tags.
   *
   * @param {string} channelId
   * @param {string} tagId
   * @returns {Promise<ForumTag[]>} Updated list of tags
   *
   * @example
   * await manager.removeTag('forumChannelId', 'tagId');
   */
  async removeTag(channelId, tagId) {
    if (!channelId || !tagId) throw new Error('[discordjs-plus] ForumTagManager#removeTag: channelId and tagId are required.');

    const existingTags = await this.fetchAll(channelId);
    const tagExists = existingTags.some((t) => t.id === tagId);

    if (!tagExists) throw new Error(`[discordjs-plus] ForumTagManager#removeTag: Tag "${tagId}" not found.`);

    const updatedTags = existingTags.filter((t) => t.id !== tagId);

    const channel = await this.client.rest.patch(`/channels/${channelId}`, {
      body: { available_tags: updatedTags },
    });

    return channel.available_tags ?? [];
  }

  /**
   * Edits a specific tag in a forum channel without affecting others.
   *
   * @param {string} channelId
   * @param {string} tagId
   * @param {Partial<CreateTagData>} data
   * @returns {Promise<ForumTag[]>} Updated list of tags
   *
   * @example
   * await manager.editTag('forumChannelId', 'tagId', {
   *   name: 'Critical Bug',
   *   emojiName: '🔴'
   * });
   */
  async editTag(channelId, tagId, data) {
    if (!channelId || !tagId) throw new Error('[discordjs-plus] ForumTagManager#editTag: channelId and tagId are required.');

    const existingTags = await this.fetchAll(channelId);
    const tagIndex = existingTags.findIndex((t) => t.id === tagId);

    if (tagIndex === -1) throw new Error(`[discordjs-plus] ForumTagManager#editTag: Tag "${tagId}" not found.`);

    const existing = existingTags[tagIndex];
    const updatedTag = {
      ...existing,
      name: data.name ?? existing.name,
      moderated: data.moderated ?? existing.moderated,
      emoji_id: data.emojiId ?? existing.emoji_id ?? null,
      emoji_name: data.emojiName ?? existing.emoji_name ?? null,
    };

    existingTags[tagIndex] = updatedTag;

    const channel = await this.client.rest.patch(`/channels/${channelId}`, {
      body: { available_tags: existingTags },
    });

    return channel.available_tags ?? [];
  }

  /**
   * Reorders tags in a forum channel.
   * @param {string} channelId
   * @param {string[]} tagIdOrder - Array of tag IDs in desired order
   * @returns {Promise<ForumTag[]>}
   */
  async reorderTags(channelId, tagIdOrder) {
    if (!channelId) throw new Error('[discordjs-plus] ForumTagManager#reorderTags: channelId is required.');
    if (!Array.isArray(tagIdOrder)) throw new Error('[discordjs-plus] ForumTagManager#reorderTags: tagIdOrder must be an array of tag IDs.');

    const existingTags = await this.fetchAll(channelId);

    const reordered = tagIdOrder
      .map((id) => existingTags.find((t) => t.id === id))
      .filter(Boolean);

    // Append any tags not mentioned in the order at the end
    const mentioned = new Set(tagIdOrder);
    const remainder = existingTags.filter((t) => !mentioned.has(t.id));

    const channel = await this.client.rest.patch(`/channels/${channelId}`, {
      body: { available_tags: [...reordered, ...remainder] },
    });

    return channel.available_tags ?? [];
  }

  /**
   * Sets the applied tags of a forum thread (post).
   * discord.js does not validate tag limits — this does.
   *
   * @param {string} threadId
   * @param {string[]} tagIds - Array of tag IDs to apply (max 5)
   * @returns {Promise<Object>} Updated thread object
   */
  async setThreadTags(threadId, tagIds) {
    if (!threadId) throw new Error('[discordjs-plus] ForumTagManager#setThreadTags: threadId is required.');
    if (!Array.isArray(tagIds)) throw new Error('[discordjs-plus] ForumTagManager#setThreadTags: tagIds must be an array.');
    if (tagIds.length > 5) throw new Error('[discordjs-plus] ForumTagManager#setThreadTags: Cannot apply more than 5 tags to a thread.');

    return this.client.rest.patch(`/channels/${threadId}`, {
      body: { applied_tags: tagIds },
    });
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /** @private */
  _buildTag(data) {
    return {
      id: '0', // Discord generates the real ID on creation
      name: data.name,
      moderated: data.moderated ?? false,
      emoji_id: data.emojiId ?? null,
      emoji_name: data.emojiName ?? null,
    };
  }
}

module.exports = { ForumTagManager };

/**
 * @typedef {Object} ForumTag
 * @property {string} id
 * @property {string} name
 * @property {boolean} moderated - Only moderators can apply this tag
 * @property {string|null} emoji_id
 * @property {string|null} emoji_name
 */

/**
 * @typedef {Object} CreateTagData
 * @property {string} name - Tag name (max 20 chars)
 * @property {boolean} [moderated=false] - Restrict tag use to moderators
 * @property {string} [emojiId] - Custom emoji ID
 * @property {string} [emojiName] - Unicode emoji
 */
