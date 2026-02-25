'use strict';

/**
 * Manages Guild Onboarding — the flow shown to new members.
 * The Discord API supports full onboarding CRUD, but discord.js
 * provides read-only access and does not expose editing prompts.
 *
 * Discord API Reference: https://discord.com/developers/docs/resources/guild#guild-onboarding-object
 */
class GuildOnboardingManager {
  /**
   * @param {import('discord.js').Client} client
   */
  constructor(client) {
    if (!client?.rest) {
      throw new Error('[discordjs-plus] GuildOnboardingManager requires a valid discord.js Client instance.');
    }
    this.client = client;
  }

  /**
   * Fetches the onboarding configuration for a guild.
   * @param {string} guildId
   * @returns {Promise<GuildOnboarding>}
   *
   * @example
   * const onboarding = await manager.fetch('guildId');
   * console.log(`Onboarding enabled: ${onboarding.enabled}`);
   * console.log(`Mode: ${onboarding.mode === 0 ? 'Default' : 'Advanced'}`);
   */
  async fetch(guildId) {
    if (!guildId) throw new Error('[discordjs-plus] GuildOnboardingManager#fetch: guildId is required.');
    return this.client.rest.get(`/guilds/${guildId}/onboarding`);
  }

  /**
   * Updates the onboarding configuration for a guild.
   * Requires MANAGE_GUILD and MANAGE_ROLES permissions.
   *
   * @param {string} guildId
   * @param {EditOnboardingData} data
   * @returns {Promise<GuildOnboarding>}
   *
   * @example
   * await manager.edit('guildId', {
   *   enabled: true,
   *   mode: 0,
   *   defaultChannelIds: ['channelId1', 'channelId2'],
   *   prompts: [
   *     {
   *       type: 0,
   *       title: 'Choose your roles',
   *       options: [
   *         {
   *           title: 'Developer',
   *           description: 'I write code',
   *           roleIds: ['roleId'],
   *           channelIds: [],
   *           emojiName: '💻'
   *         }
   *       ],
   *       singleSelect: false,
   *       required: false,
   *       inOnboarding: true
   *     }
   *   ]
   * });
   */
  async edit(guildId, data) {
    if (!guildId) throw new Error('[discordjs-plus] GuildOnboardingManager#edit: guildId is required.');

    const body = {};

    if (data.prompts !== undefined) {
      body.prompts = data.prompts.map((p) => ({
        id: p.id ?? '0',
        type: p.type ?? 0,
        title: p.title,
        single_select: p.singleSelect ?? false,
        required: p.required ?? false,
        in_onboarding: p.inOnboarding ?? true,
        options: (p.options ?? []).map((o) => ({
          id: o.id ?? '0',
          title: o.title,
          description: o.description ?? '',
          role_ids: o.roleIds ?? [],
          channel_ids: o.channelIds ?? [],
          emoji: o.emojiId
            ? { id: o.emojiId, name: o.emojiName ?? null }
            : o.emojiName
            ? { name: o.emojiName }
            : undefined,
        })),
      }));
    }

    if (data.defaultChannelIds !== undefined) body.default_channel_ids = data.defaultChannelIds;
    if (data.enabled !== undefined) body.enabled = data.enabled;
    if (data.mode !== undefined) body.mode = data.mode;

    return this.client.rest.put(`/guilds/${guildId}/onboarding`, { body });
  }

  /**
   * Adds a channel to the onboarding default channels list.
   * @param {string} guildId
   * @param {string} channelId
   * @returns {Promise<GuildOnboarding>}
   */
  async addDefaultChannel(guildId, channelId) {
    if (!guildId || !channelId) throw new Error('[discordjs-plus] GuildOnboardingManager#addDefaultChannel: guildId and channelId are required.');

    const current = await this.fetch(guildId);
    const channelIds = [...new Set([...(current.default_channel_ids ?? []), channelId])];

    return this.edit(guildId, { defaultChannelIds: channelIds });
  }

  /**
   * Removes a channel from the onboarding default channels list.
   * @param {string} guildId
   * @param {string} channelId
   * @returns {Promise<GuildOnboarding>}
   */
  async removeDefaultChannel(guildId, channelId) {
    if (!guildId || !channelId) throw new Error('[discordjs-plus] GuildOnboardingManager#removeDefaultChannel: guildId and channelId are required.');

    const current = await this.fetch(guildId);
    const channelIds = (current.default_channel_ids ?? []).filter((id) => id !== channelId);

    return this.edit(guildId, { defaultChannelIds: channelIds });
  }
}

module.exports = { GuildOnboardingManager };

/**
 * @typedef {Object} GuildOnboarding
 * @property {string} guild_id
 * @property {Object[]} prompts
 * @property {string[]} default_channel_ids
 * @property {boolean} enabled
 * @property {0|1} mode - 0 = ONBOARDING_DEFAULT, 1 = ONBOARDING_ADVANCED
 */

/**
 * @typedef {Object} EditOnboardingData
 * @property {OnboardingPrompt[]} [prompts]
 * @property {string[]} [defaultChannelIds]
 * @property {boolean} [enabled]
 * @property {0|1} [mode]
 */
