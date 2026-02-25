'use strict';

/**
 * Applies monkey-patches and fixes to discord.js classes.
 * Call this function once after your Client is ready.
 *
 * PATCHES APPLIED:
 * 1. Message#awaitReactions — fixes the `idle` option being ignored
 * 2. GuildMember#banner — adds missing banner URL getter
 * 3. Interaction#isFromGuild — adds missing utility method
 * 4. TextChannel#sendTypingFor — adds a helper to type for N seconds
 * 5. Collection#findAll — adds missing multi-result find method
 */

function applyPatches() {
  try {
    const discord = require('discord.js');

    _patchCollection(discord.Collection);
    _patchMessage(discord);
    _patchGuildMember(discord);
    _patchBaseInteraction(discord);
    _patchTextChannel(discord);

    console.log('[discordjs-plus] Patches applied successfully.');
  } catch (err) {
    console.error('[discordjs-plus] Failed to apply patches:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 1: Collection#findAll
// discord.js Collection only has .find() which returns one item.
// This adds .findAll() which returns ALL matching items.
// ─────────────────────────────────────────────────────────────────────────────
function _patchCollection(Collection) {
  if (!Collection?.prototype) return;
  if (Collection.prototype.findAll) return; // Already patched

  /**
   * Finds all values in the Collection that satisfy the predicate.
   * @template V
   * @param {(value: V) => boolean} fn
   * @returns {V[]}
   *
   * @example
   * const onlineMembers = guild.members.cache.findAll(m => m.presence?.status === 'online');
   */
  Collection.prototype.findAll = function (fn) {
    const results = [];
    for (const value of this.values()) {
      if (fn(value)) results.push(value);
    }
    return results;
  };

  /**
   * Returns a random subset of items from the Collection.
   * @param {number} count
   * @returns {any[]}
   *
   * @example
   * const fiveRandomMembers = guild.members.cache.random(5);
   */
  Collection.prototype.random = function (count = 1) {
    const arr = [...this.values()];
    const shuffled = arr.sort(() => Math.random() - 0.5);
    return count === 1 ? shuffled[0] : shuffled.slice(0, count);
  };

  /**
   * Groups collection items by a key returned from the callback.
   * @param {(value: any) => string} fn
   * @returns {Object.<string, any[]>}
   *
   * @example
   * const byRole = guild.members.cache.groupBy(m => m.roles.highest.name);
   */
  Collection.prototype.groupBy = function (fn) {
    const groups = {};
    for (const value of this.values()) {
      const key = fn(value);
      if (!groups[key]) groups[key] = [];
      groups[key].push(value);
    }
    return groups;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 2: Message — awaitReactions idle fix + crosspost safety
// BUG: In discord.js, passing `idle` to awaitReactions is ignored if no
// events come in because the idle timer is not reset on filtered-out events.
// ─────────────────────────────────────────────────────────────────────────────
function _patchMessage({ Message }) {
  if (!Message?.prototype) return;

  const _orig = Message.prototype.awaitReactions;

  Message.prototype.awaitReactions = function (options = {}) {
    // If idle is not set, use original
    if (!options.idle) return _orig.call(this, options);

    // Wrap with a timeout that resets on any reaction (even filtered-out ones)
    return new Promise((resolve, reject) => {
      let idleTimer = null;
      const collected = new Map();

      const reset = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          this.client.off('messageReactionAdd', onReaction);
          resolve(collected);
        }, options.idle);
      };

      const filter = options.filter ?? (() => true);

      const onReaction = async (reaction, user) => {
        if (reaction.message.id !== this.id) return;
        reset(); // Reset idle timer on ANY reaction on this message
        try {
          if (await Promise.resolve(filter(reaction, user))) {
            collected.set(`${user.id}-${reaction.emoji.toString()}`, reaction);
            if (options.max && collected.size >= options.max) {
              clearTimeout(idleTimer);
              this.client.off('messageReactionAdd', onReaction);
              resolve(collected);
            }
          }
        } catch (err) {
          reject(err);
        }
      };

      this.client.on('messageReactionAdd', onReaction);
      reset();

      if (options.time) {
        setTimeout(() => {
          clearTimeout(idleTimer);
          this.client.off('messageReactionAdd', onReaction);
          resolve(collected);
        }, options.time);
      }
    });
  };

  /**
   * Safely crossposts a message — catches errors if it's not in an announcement channel.
   * discord.js throws an error instead of resolving gracefully.
   *
   * @returns {Promise<Message|null>}
   */
  if (!Message.prototype.safeCrosspost) {
    Message.prototype.safeCrosspost = async function () {
      try {
        return await this.crosspost();
      } catch {
        return null;
      }
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 3: GuildMember — banner URL getter
// discord.js exposes user.bannerURL() but NOT member.bannerURL() (guild-specific banner).
// The Discord API supports per-guild banners since 2022.
// ─────────────────────────────────────────────────────────────────────────────
function _patchGuildMember({ GuildMember }) {
  if (!GuildMember?.prototype) return;
  if (GuildMember.prototype.guildBannerURL) return;

  /**
   * Returns the guild-specific banner URL for this member, if set.
   * Falls back to global user banner if no guild banner exists.
   *
   * @param {{ size?: number, format?: string }} [options]
   * @returns {string|null}
   *
   * @example
   * const banner = member.guildBannerURL({ size: 1024 });
   * if (banner) await channel.send({ files: [banner] });
   */
  GuildMember.prototype.guildBannerURL = function (options = {}) {
    const size = options.size ?? 1024;
    const format = options.format ?? 'png';

    // _banner is the raw API field for guild-specific member banner
    const guildBanner = this._banner ?? this.banner;

    if (guildBanner) {
      return `https://cdn.discordapp.com/guilds/${this.guild.id}/users/${this.id}/banners/${guildBanner}.${format}?size=${size}`;
    }

    // Fallback to global user banner
    return this.user.bannerURL(options) ?? null;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 4: BaseInteraction — utility methods missing from discord.js
// ─────────────────────────────────────────────────────────────────────────────
function _patchBaseInteraction({ BaseInteraction }) {
  if (!BaseInteraction?.prototype) return;

  /**
   * Whether this interaction was triggered inside a guild (server).
   * More explicit than checking `interaction.guildId !== null`.
   * @returns {boolean}
   */
  if (!BaseInteraction.prototype.isFromGuild) {
    BaseInteraction.prototype.isFromGuild = function () {
      return this.guildId !== null;
    };
  }

  /**
   * Returns the channel locale of the interaction, falling back to guild locale, then 'en-US'.
   * discord.js exposes locale but not a resolved fallback chain.
   * @returns {string}
   */
  if (!BaseInteraction.prototype.resolvedLocale) {
    Object.defineProperty(BaseInteraction.prototype, 'resolvedLocale', {
      get() {
        return this.locale ?? this.guildLocale ?? 'en-US';
      },
      configurable: true,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 5: TextChannel — sendTypingFor helper
// discord.js's sendTyping() only sends one typing indicator (~10s).
// This helper repeats it for a given duration.
// ─────────────────────────────────────────────────────────────────────────────
function _patchTextChannel({ TextChannel, DMChannel, ThreadChannel }) {
  const channels = [TextChannel, DMChannel, ThreadChannel].filter(Boolean);

  for (const ChannelClass of channels) {
    if (!ChannelClass?.prototype || ChannelClass.prototype.sendTypingFor) continue;

    /**
     * Sends a typing indicator repeatedly for the specified duration.
     * Useful for commands that take a long time to process.
     *
     * @param {number} durationMs - How long to type in milliseconds (max 60000 recommended)
     * @returns {{ stop: () => void }} An object with a stop() method to cancel early
     *
     * @example
     * const typing = channel.sendTypingFor(10_000);
     * const result = await doHeavyWork();
     * typing.stop();
     * await channel.send(result);
     */
    ChannelClass.prototype.sendTypingFor = function (durationMs) {
      if (typeof durationMs !== 'number' || durationMs <= 0) {
        throw new Error('[discordjs-plus] sendTypingFor: durationMs must be a positive number.');
      }

      let active = true;
      const TYPING_INTERVAL = 8_500; // Discord typing lasts ~10s, refresh every 8.5s

      const send = () => {
        if (!active) return;
        this.sendTyping().catch(() => {}); // Ignore errors silently
      };

      send();
      const interval = setInterval(send, TYPING_INTERVAL);
      const timeout = setTimeout(() => {
        active = false;
        clearInterval(interval);
      }, durationMs);

      return {
        stop() {
          active = false;
          clearInterval(interval);
          clearTimeout(timeout);
        },
      };
    };
  }
}

module.exports = { applyPatches };
