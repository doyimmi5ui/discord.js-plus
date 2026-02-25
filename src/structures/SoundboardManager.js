'use strict';

/**
 * Manages Discord Soundboard sounds.
 * The Discord Soundboard API exists since 2023 but discord.js has no native manager for it.
 *
 * Discord API Reference: https://discord.com/developers/docs/resources/soundboard
 */
class SoundboardManager {
  /**
   * @param {import('discord.js').Client} client
   */
  constructor(client) {
    if (!client?.rest) {
      throw new Error('[discordjs-plus] SoundboardManager requires a valid discord.js Client instance.');
    }
    this.client = client;
  }

  /**
   * Fetches the default Discord soundboard sounds (available in every server).
   * @returns {Promise<SoundboardSound[]>}
   *
   * @example
   * const sounds = await manager.getDefaultSounds();
   * console.log(sounds.map(s => s.name));
   */
  async getDefaultSounds() {
    const data = await this.client.rest.get('/soundboard-default-sounds');
    return data ?? [];
  }

  /**
   * Fetches all soundboard sounds available in a guild.
   * @param {string} guildId
   * @returns {Promise<SoundboardSound[]>}
   *
   * @example
   * const sounds = await manager.getGuildSounds('guildId');
   */
  async getGuildSounds(guildId) {
    if (!guildId) throw new Error('[discordjs-plus] SoundboardManager#getGuildSounds: guildId is required.');
    const data = await this.client.rest.get(`/guilds/${guildId}/soundboard-sounds`);
    return data?.items ?? [];
  }

  /**
   * Fetches a single guild soundboard sound.
   * @param {string} guildId
   * @param {string} soundId
   * @returns {Promise<SoundboardSound>}
   */
  async getGuildSound(guildId, soundId) {
    if (!guildId || !soundId) throw new Error('[discordjs-plus] SoundboardManager#getGuildSound: guildId and soundId are required.');
    return this.client.rest.get(`/guilds/${guildId}/soundboard-sounds/${soundId}`);
  }

  /**
   * Creates a new soundboard sound in a guild.
   * Requires MANAGE_GUILD_EXPRESSIONS permission.
   *
   * @param {string} guildId
   * @param {CreateSoundData} data
   * @returns {Promise<SoundboardSound>}
   *
   * @example
   * const fs = require('fs');
   * const sound = await manager.create('guildId', {
   *   name: 'my-sound',
   *   sound: `data:audio/ogg;base64,${fs.readFileSync('./sound.ogg').toString('base64')}`,
   *   volume: 1.0,
   *   emojiName: '🔊'
   * });
   */
  async create(guildId, data) {
    if (!guildId) throw new Error('[discordjs-plus] SoundboardManager#create: guildId is required.');
    if (!data?.name) throw new Error('[discordjs-plus] SoundboardManager#create: data.name is required.');
    if (!data?.sound) throw new Error('[discordjs-plus] SoundboardManager#create: data.sound (base64 audio) is required.');

    const body = {
      name: data.name,
      sound: data.sound,
      volume: data.volume ?? 1.0,
      ...(data.emojiId ? { emoji_id: data.emojiId } : {}),
      ...(data.emojiName ? { emoji_name: data.emojiName } : {}),
    };

    return this.client.rest.post(`/guilds/${guildId}/soundboard-sounds`, { body });
  }

  /**
   * Edits an existing soundboard sound.
   * @param {string} guildId
   * @param {string} soundId
   * @param {EditSoundData} data
   * @returns {Promise<SoundboardSound>}
   */
  async edit(guildId, soundId, data) {
    if (!guildId || !soundId) throw new Error('[discordjs-plus] SoundboardManager#edit: guildId and soundId are required.');

    const body = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.volume !== undefined) body.volume = data.volume;
    if (data.emojiId !== undefined) body.emoji_id = data.emojiId;
    if (data.emojiName !== undefined) body.emoji_name = data.emojiName;

    return this.client.rest.patch(`/guilds/${guildId}/soundboard-sounds/${soundId}`, { body });
  }

  /**
   * Deletes a soundboard sound from a guild.
   * @param {string} guildId
   * @param {string} soundId
   * @returns {Promise<void>}
   */
  async delete(guildId, soundId) {
    if (!guildId || !soundId) throw new Error('[discordjs-plus] SoundboardManager#delete: guildId and soundId are required.');
    await this.client.rest.delete(`/guilds/${guildId}/soundboard-sounds/${soundId}`);
  }

  /**
   * Sends a soundboard sound to a voice channel.
   * This is a gateway event — the bot must be in the voice channel.
   *
   * @param {string} channelId - Voice channel ID
   * @param {string} soundId - Sound ID to play
   * @param {string} [sourceGuildId] - Guild where the sound comes from (omit for default sounds)
   * @returns {void}
   *
   * @example
   * manager.sendSound('voiceChannelId', 'soundId', 'guildId');
   */
  sendSound(channelId, soundId, sourceGuildId) {
    if (!channelId || !soundId) throw new Error('[discordjs-plus] SoundboardManager#sendSound: channelId and soundId are required.');

    // Uses the gateway to send the sound
    this.client.ws.broadcast({
      op: 31, // SEND_SOUNDBOARD_SOUND opcode
      d: {
        channel_id: channelId,
        sound_id: soundId,
        ...(sourceGuildId ? { source_guild_id: sourceGuildId } : {}),
      },
    });
  }
}

module.exports = { SoundboardManager };

/**
 * @typedef {Object} SoundboardSound
 * @property {string} sound_id
 * @property {string} name
 * @property {number} volume - 0.0 to 1.0
 * @property {string|null} emoji_id
 * @property {string|null} emoji_name
 * @property {string|null} guild_id - null for default sounds
 * @property {boolean} available
 * @property {Object|null} user
 */

/**
 * @typedef {Object} CreateSoundData
 * @property {string} name - Sound name (2–32 chars)
 * @property {string} sound - Base64 encoded audio (max 512KB, OGG format)
 * @property {number} [volume=1.0] - Volume (0.0 to 1.0)
 * @property {string} [emojiId] - Custom emoji ID
 * @property {string} [emojiName] - Unicode emoji name
 */

/**
 * @typedef {Object} EditSoundData
 * @property {string} [name]
 * @property {number} [volume]
 * @property {string} [emojiId]
 * @property {string} [emojiName]
 */
