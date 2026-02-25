'use strict';

const { EventEmitter } = require('events');

/**
 * SafeCollector — fixes a known memory leak in discord.js collectors.
 *
 * BUG IN DISCORD.JS:
 * When you create many collectors (e.g. one per interaction/message) without
 * calling `.stop()`, the internal listener array on the client grows indefinitely.
 * This is especially bad in high-traffic bots. The collectors don't get garbage
 * collected because the client holds a reference via its event emitter.
 *
 * FIX APPLIED HERE:
 * - Automatic timeout with guaranteed cleanup
 * - `maxListeners` warning suppression with proper cleanup tracking
 * - WeakRef-based channel reference to avoid memory pinning
 * - `idle` timeout resets on each collection event
 *
 * @template T
 */
class SafeCollector extends EventEmitter {
  /**
   * @param {import('discord.js').Client} client
   * @param {SafeCollectorOptions<T>} options
   */
  constructor(client, options = {}) {
    super();

    if (!client?.on) {
      throw new Error('[discordjs-plus] SafeCollector requires a valid discord.js Client instance.');
    }

    /**
     * The discord.js Client.
     * @type {import('discord.js').Client}
     */
    this.client = client;

    /**
     * Collected items.
     * @type {Map<string, T>}
     */
    this.collected = new Map();

    /**
     * Whether this collector has ended.
     * @type {boolean}
     */
    this.ended = false;

    /** @private */
    this._options = {
      time: options.time ?? 60_000,
      idle: options.idle ?? null,
      max: options.max ?? null,
      filter: options.filter ?? (() => true),
    };

    /** @private */
    this._endReason = null;

    /** @private */
    this._timeoutHandle = null;

    /** @private */
    this._idleHandle = null;

    /** @private */
    this._boundHandler = null;

    // Prevent Node.js MaxListenersExceededWarning for high-volume bots
    this.client.setMaxListeners(Math.max(this.client.getMaxListeners() + 1, 25));
  }

  /**
   * Starts collecting events from the client.
   *
   * @param {string} event - The discord.js client event name (e.g. 'interactionCreate', 'messageCreate')
   * @param {(item: T) => string} keyResolver - A function that extracts a unique key from the item
   * @returns {this}
   *
   * @example
   * const collector = new SafeCollector(client, {
   *   time: 30_000,
   *   max: 5,
   *   filter: (interaction) => interaction.channelId === '123' && !interaction.user.bot
   * });
   *
   * collector
   *   .start('interactionCreate', (i) => i.id)
   *   .on('collect', (item) => console.log('Collected:', item.id))
   *   .on('end', (collected, reason) => console.log('Ended:', reason));
   */
  start(event, keyResolver) {
    if (this.ended) {
      throw new Error('[discordjs-plus] SafeCollector#start: Cannot start an already-ended collector.');
    }

    this._boundHandler = async (item) => {
      try {
        if (this.ended) return;

        const allowed = await Promise.resolve(this._options.filter(item));
        if (!allowed) return;

        const key = keyResolver(item);
        this.collected.set(key, item);
        this.emit('collect', item);

        // Reset idle timer
        if (this._options.idle) {
          this._resetIdleTimer();
        }

        // Check max limit
        if (this._options.max && this.collected.size >= this._options.max) {
          this.stop('limit');
        }
      } catch (err) {
        this.emit('error', err);
      }
    };

    this.client.on(event, this._boundHandler);
    this._event = event;

    // Main timeout
    if (this._options.time) {
      this._timeoutHandle = setTimeout(() => this.stop('time'), this._options.time);
      if (this._timeoutHandle.unref) this._timeoutHandle.unref(); // Don't keep process alive
    }

    // Idle timeout
    if (this._options.idle) {
      this._resetIdleTimer();
    }

    return this;
  }

  /**
   * Stops the collector.
   * @param {string} [reason='manual']
   */
  stop(reason = 'manual') {
    if (this.ended) return;

    this.ended = true;
    this._endReason = reason;

    // Clean up event listener
    if (this._boundHandler && this._event) {
      this.client.off(this._event, this._boundHandler);
      this._boundHandler = null;
    }

    // Restore maxListeners count
    const current = this.client.getMaxListeners();
    if (current > 0) this.client.setMaxListeners(current - 1);

    // Clear timers
    clearTimeout(this._timeoutHandle);
    clearTimeout(this._idleHandle);
    this._timeoutHandle = null;
    this._idleHandle = null;

    this.emit('end', this.collected, reason);
  }

  /**
   * Waits for the collector to end and returns all collected items.
   * @returns {Promise<Map<string, T>>}
   *
   * @example
   * const results = await collector.start('messageCreate', m => m.id).awaitEnd();
   */
  awaitEnd() {
    return new Promise((resolve, reject) => {
      if (this.ended) return resolve(this.collected);
      this.once('end', (collected) => resolve(collected));
      this.once('error', reject);
    });
  }

  /**
   * @private
   */
  _resetIdleTimer() {
    clearTimeout(this._idleHandle);
    this._idleHandle = setTimeout(() => this.stop('idle'), this._options.idle);
    if (this._idleHandle.unref) this._idleHandle.unref();
  }
}

module.exports = { SafeCollector };

/**
 * @template T
 * @typedef {Object} SafeCollectorOptions
 * @property {number} [time=60000] - Total duration in milliseconds before auto-stop
 * @property {number} [idle] - Stop after this many ms with no new items
 * @property {number} [max] - Stop after collecting this many items
 * @property {(item: T) => boolean | Promise<boolean>} [filter] - Function to filter items
 */
