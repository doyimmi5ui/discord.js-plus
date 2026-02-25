'use strict';

/**
 * Manages Application-level Emojis — emojis tied to the application itself,
 * not to any specific guild. Introduced in Discord API v10 (2024) but
 * not yet fully supported in discord.js v14.
 *
 * These emojis can be used in any server without Nitro by bots.
 * Discord API Reference: https://discord.com/developers/docs/resources/emoji
 */
class ApplicationEmojiManager {
  /**
   * @param {import('discord.js').Client} client
   */
  constructor(client) {
    if (!client?.rest) {
      throw new Error('[discordjs-plus] ApplicationEmojiManager requires a valid discord.js Client instance.');
    }
    this.client = client;
  }

  /**
   * Gets the application ID from the client.
   * @private
   * @returns {string}
   */
  get _appId() {
    const id = this.client.application?.id ?? this.client.user?.id;
    if (!id) throw new Error('[discordjs-plus] ApplicationEmojiManager: client.application.id is not available. Make sure the client is ready.');
    return id;
  }

  /**
   * Fetches all emojis belonging to this application.
   * @returns {Promise<ApplicationEmoji[]>}
   *
   * @example
   * const emojis = await manager.fetchAll();
   * console.log(emojis.map(e => `<:${e.name}:${e.id}>`));
   */
  async fetchAll() {
    const data = await this.client.rest.get(`/applications/${this._appId}/emojis`);
    return data?.items ?? [];
  }

  /**
   * Fetches a single application emoji by ID.
   * @param {string} emojiId
   * @returns {Promise<ApplicationEmoji>}
   */
  async fetch(emojiId) {
    if (!emojiId) throw new Error('[discordjs-plus] ApplicationEmojiManager#fetch: emojiId is required.');
    return this.client.rest.get(`/applications/${this._appId}/emojis/${emojiId}`);
  }

  /**
   * Creates a new application emoji.
   *
   * @param {CreateApplicationEmojiData} data
   * @returns {Promise<ApplicationEmoji>}
   *
   * @example
   * const fs = require('fs');
   * const emoji = await manager.create({
   *   name: 'my_emoji',
   *   image: `data:image/png;base64,${fs.readFileSync('./emoji.png').toString('base64')}`
   * });
   * console.log(`Created: <:${emoji.name}:${emoji.id}>`);
   */
  async create(data) {
    if (!data?.name) throw new Error('[discordjs-plus] ApplicationEmojiManager#create: data.name is required.');
    if (!data?.image) throw new Error('[discordjs-plus] ApplicationEmojiManager#create: data.image (base64) is required.');

    // Validate name: only alphanumeric and underscores
    if (!/^[a-zA-Z0-9_]{2,32}$/.test(data.name)) {
      throw new Error('[discordjs-plus] ApplicationEmojiManager#create: Emoji name must be 2–32 characters (letters, numbers, underscores only).');
    }

    return this.client.rest.post(`/applications/${this._appId}/emojis`, {
      body: {
        name: data.name,
        image: data.image,
      },
    });
  }

  /**
   * Edits an existing application emoji's name.
   * @param {string} emojiId
   * @param {string} newName
   * @returns {Promise<ApplicationEmoji>}
   */
  async edit(emojiId, newName) {
    if (!emojiId) throw new Error('[discordjs-plus] ApplicationEmojiManager#edit: emojiId is required.');
    if (!newName) throw new Error('[discordjs-plus] ApplicationEmojiManager#edit: newName is required.');

    if (!/^[a-zA-Z0-9_]{2,32}$/.test(newName)) {
      throw new Error('[discordjs-plus] ApplicationEmojiManager#edit: Emoji name must be 2–32 characters (letters, numbers, underscores only).');
    }

    return this.client.rest.patch(`/applications/${this._appId}/emojis/${emojiId}`, {
      body: { name: newName },
    });
  }

  /**
   * Deletes an application emoji.
   * @param {string} emojiId
   * @returns {Promise<void>}
   */
  async delete(emojiId) {
    if (!emojiId) throw new Error('[discordjs-plus] ApplicationEmojiManager#delete: emojiId is required.');
    await this.client.rest.delete(`/applications/${this._appId}/emojis/${emojiId}`);
  }

  /**
   * Converts an application emoji to a usable string format for messages.
   * @param {ApplicationEmoji} emoji
   * @returns {string} e.g. "<:name:id>" or "<a:name:id>"
   *
   * @example
   * const emoji = await manager.fetch('123');
   * await channel.send(`Hello ${manager.toString(emoji)}!`);
   */
  toString(emoji) {
    if (!emoji?.id || !emoji?.name) {
      throw new Error('[discordjs-plus] ApplicationEmojiManager#toString: Invalid emoji object.');
    }
    return emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
  }
}

module.exports = { ApplicationEmojiManager };

/**
 * @typedef {Object} ApplicationEmoji
 * @property {string} id
 * @property {string} name
 * @property {boolean} animated
 * @property {boolean} managed
 * @property {Object|null} user
 */

/**
 * @typedef {Object} CreateApplicationEmojiData
 * @property {string} name - Emoji name (2–32 chars, alphanumeric + underscores)
 * @property {string} image - Base64 encoded image data URI (PNG, JPG, GIF)
 */
