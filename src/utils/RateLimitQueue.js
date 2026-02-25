'use strict';

/**
 * RateLimitQueue — an intelligent REST queue that handles Discord rate limits gracefully.
 *
 * PROBLEM IN DISCORD.JS:
 * When you fire many REST calls simultaneously (e.g. sending 50 messages in a loop),
 * discord.js queues them but throws "You are being rate limited" errors if the global
 * rate limit is exceeded, or silently drops requests in some edge cases.
 *
 * discord.js also does not expose a way to set per-request retry logic or prioritization.
 *
 * THIS CLASS:
 * - Provides a priority queue (high/normal/low)
 * - Automatically retries on 429 responses with the correct retry_after delay
 * - Emits events so you can monitor rate limit hits
 * - Supports burst mode (process as fast as possible) vs. steady mode (throttled)
 */
class RateLimitQueue extends (require('events').EventEmitter) {
  /**
   * @param {RateLimitQueueOptions} [options]
   */
  constructor(options = {}) {
    super();

    /**
     * @private
     * @type {QueueEntry[]}
     */
    this._queue = [];

    /**
     * @private
     */
    this._running = false;

    /**
     * @private
     */
    this._options = {
      maxRetries: options.maxRetries ?? 3,
      baseDelay: options.baseDelay ?? 0,      // ms between requests in steady mode
      concurrency: options.concurrency ?? 1,  // simultaneous requests (keep at 1 for safety)
      onRateLimit: options.onRateLimit ?? null,
    };

    /** @private */
    this._active = 0;

    /** @private */
    this._stats = {
      total: 0,
      success: 0,
      rateLimited: 0,
      failed: 0,
    };
  }

  /**
   * Adds a task to the queue.
   *
   * @template T
   * @param {() => Promise<T>} fn - Async function to execute (should return a REST call)
   * @param {EnqueueOptions} [options]
   * @returns {Promise<T>}
   *
   * @example
   * const queue = new RateLimitQueue({ baseDelay: 100 });
   *
   * const results = await Promise.all(
   *   channelIds.map(id => queue.add(() => client.channels.fetch(id)))
   * );
   */
  add(fn, options = {}) {
    if (typeof fn !== 'function') {
      return Promise.reject(new Error('[discordjs-plus] RateLimitQueue#add: fn must be a function.'));
    }

    const priority = options.priority ?? 'normal';
    const priorityOrder = { high: 0, normal: 1, low: 2 };

    return new Promise((resolve, reject) => {
      const entry = {
        fn,
        resolve,
        reject,
        priority: priorityOrder[priority] ?? 1,
        retries: 0,
        label: options.label ?? null,
      };

      // Insert at correct priority position
      const insertAt = this._queue.findIndex((e) => e.priority > entry.priority);
      if (insertAt === -1) {
        this._queue.push(entry);
      } else {
        this._queue.splice(insertAt, 0, entry);
      }

      this._stats.total++;
      this._tick();
    });
  }

  /**
   * Adds multiple tasks at once and waits for all to complete.
   * @template T
   * @param {Array<() => Promise<T>>} fns
   * @param {EnqueueOptions} [options]
   * @returns {Promise<T[]>}
   */
  addAll(fns, options = {}) {
    return Promise.all(fns.map((fn) => this.add(fn, options)));
  }

  /**
   * Clears all pending tasks in the queue (does not stop running tasks).
   * @returns {number} Number of tasks cleared
   */
  clear() {
    const count = this._queue.length;
    const cleared = this._queue.splice(0);
    for (const entry of cleared) {
      entry.reject(new Error('[discordjs-plus] RateLimitQueue: Task was cleared before execution.'));
    }
    return count;
  }

  /**
   * Returns current queue statistics.
   * @returns {QueueStats}
   */
  getStats() {
    return {
      ...this._stats,
      pending: this._queue.length,
      active: this._active,
    };
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /** @private */
  _tick() {
    if (this._active >= this._options.concurrency) return;
    if (this._queue.length === 0) return;

    const entry = this._queue.shift();
    this._active++;
    this._execute(entry);
  }

  /** @private */
  async _execute(entry) {
    try {
      if (this._options.baseDelay > 0) {
        await this._sleep(this._options.baseDelay);
      }

      const result = await entry.fn();
      this._stats.success++;
      entry.resolve(result);
    } catch (err) {
      const isRateLimit = this._isRateLimitError(err);

      if (isRateLimit) {
        this._stats.rateLimited++;
        const retryAfter = this._extractRetryAfter(err);
        this.emit('rateLimited', { retryAfter, label: entry.label, retries: entry.retries });

        if (this._options.onRateLimit) {
          this._options.onRateLimit({ retryAfter, entry });
        }

        if (entry.retries < this._options.maxRetries) {
          entry.retries++;
          await this._sleep(retryAfter);
          // Re-queue at the front
          this._queue.unshift(entry);
          this._active--;
          this._tick();
          return;
        }
      }

      this._stats.failed++;
      entry.reject(err);
    } finally {
      if (this._active > 0) this._active--;
      this._tick();
    }
  }

  /** @private */
  _isRateLimitError(err) {
    return (
      err?.status === 429 ||
      err?.code === 429 ||
      err?.message?.includes('rate limit') ||
      err?.httpStatus === 429
    );
  }

  /** @private */
  _extractRetryAfter(err) {
    // discord.js DiscordAPIError has a retryAfter property
    if (err?.retryAfter) return err.retryAfter;
    // Try to extract from the raw response
    if (err?.rawError?.retry_after) return err.rawError.retry_after * 1000;
    // Fallback
    return 1000;
  }

  /** @private */
  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = { RateLimitQueue };

/**
 * @typedef {Object} RateLimitQueueOptions
 * @property {number} [maxRetries=3] - Max retries per task on rate limit
 * @property {number} [baseDelay=0] - Delay in ms between each request
 * @property {number} [concurrency=1] - Max concurrent requests
 * @property {Function} [onRateLimit] - Callback invoked on each rate limit hit
 */

/**
 * @typedef {Object} EnqueueOptions
 * @property {'high'|'normal'|'low'} [priority='normal'] - Task priority
 * @property {string} [label] - Optional label for debugging
 */

/**
 * @typedef {Object} QueueStats
 * @property {number} total
 * @property {number} success
 * @property {number} rateLimited
 * @property {number} failed
 * @property {number} pending
 * @property {number} active
 */
