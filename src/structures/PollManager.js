'use strict';

const { Routes } = require('discord.js');

/**
 * Manages Discord Polls – a feature available in the Discord API
 * but with limited/buggy support in discord.js v14.
 *
 * Discord API Reference: https://discord.com/developers/docs/resources/poll
 */
class PollManager {
  /**
   * @param {import('discord.js').Client} client - The discord.js Client instance
   */
  constructor(client) {
    if (!client || !client.rest) {
      throw new Error('[discordjs-plus] PollManager requires a valid discord.js Client instance.');
    }

    /** @type {import('discord.js').Client} */
    this.client = client;
  }

  /**
   * Creates a poll in a channel.
   * discord.js does not expose a dedicated Poll creation method — this fills that gap.
   *
   * @param {string} channelId - ID of the channel to send the poll to
   * @param {PollData} data - Poll configuration object
   * @returns {Promise<Object>} Raw Discord API message object containing the poll
   *
   * @example
   * const manager = new PollManager(client);
   * const msg = await manager.create('123456789', {
   *   question: 'What is your favorite language?',
   *   answers: ['JavaScript', 'TypeScript', 'Python'],
   *   duration: 24,       // hours
   *   allowMultiselect: false,
   *   layoutType: 1       // 1 = DEFAULT
   * });
   */
  async create(channelId, data) {
    if (!channelId) throw new Error('[discordjs-plus] PollManager#create: channelId is required.');
    if (!data?.question) throw new Error('[discordjs-plus] PollManager#create: data.question is required.');
    if (!Array.isArray(data.answers) || data.answers.length < 2) {
      throw new Error('[discordjs-plus] PollManager#create: data.answers must have at least 2 options.');
    }
    if (data.answers.length > 10) {
      throw new Error('[discordjs-plus] PollManager#create: data.answers cannot exceed 10 options.');
    }

    const pollPayload = {
      question: { text: data.question },
      answers: data.answers.map((answer, index) => ({
        answer_id: index + 1,
        poll_media: {
          text: typeof answer === 'string' ? answer : answer.text,
          ...(answer.emoji ? { emoji: this._resolveEmoji(answer.emoji) } : {}),
        },
      })),
      duration: data.duration ?? 24,
      allow_multiselect: data.allowMultiselect ?? false,
      layout_type: data.layoutType ?? 1,
    };

    return this.client.rest.post(Routes.channelMessages(channelId), {
      body: { poll: pollPayload },
    });
  }

  /**
   * Ends (expires) an active poll before its scheduled end time.
   * This endpoint exists in the Discord API but is NOT exposed by discord.js.
   *
   * @param {string} channelId - ID of the channel containing the poll
   * @param {string} messageId - ID of the message containing the poll
   * @returns {Promise<Object>} Updated message object
   *
   * @example
   * await manager.end('channelId', 'messageId');
   */
  async end(channelId, messageId) {
    if (!channelId || !messageId) {
      throw new Error('[discordjs-plus] PollManager#end: channelId and messageId are required.');
    }

    return this.client.rest.post(
      `/channels/${channelId}/polls/${messageId}/expire`
    );
  }

  /**
   * Fetches all voters for a specific answer in a poll.
   * discord.js does not provide this as a standalone manager method.
   *
   * @param {string} channelId
   * @param {string} messageId
   * @param {number} answerId - The answer_id (1-indexed)
   * @param {{ limit?: number, after?: string }} [options]
   * @returns {Promise<Object[]>} Array of user objects who voted for this answer
   *
   * @example
   * const voters = await manager.getVoters('channelId', 'messageId', 1, { limit: 100 });
   */
  async getVoters(channelId, messageId, answerId, options = {}) {
    if (!channelId || !messageId || !answerId) {
      throw new Error('[discordjs-plus] PollManager#getVoters: channelId, messageId, and answerId are required.');
    }

    const query = new URLSearchParams();
    if (options.limit) query.set('limit', String(options.limit));
    if (options.after) query.set('after', options.after);

    const qs = query.toString();
    const path = `/channels/${channelId}/polls/${messageId}/answers/${answerId}${qs ? `?${qs}` : ''}`;

    const data = await this.client.rest.get(path);
    return data.users ?? [];
  }

  /**
   * Fetches a poll's current vote counts without fetching the full message.
   *
   * @param {string} channelId
   * @param {string} messageId
   * @returns {Promise<PollResults>}
   */
  async getResults(channelId, messageId) {
    const message = await this.client.rest.get(
      Routes.channelMessage(channelId, messageId)
    );

    if (!message.poll) {
      throw new Error('[discordjs-plus] PollManager#getResults: This message does not contain a poll.');
    }

    const poll = message.poll;
    return {
      question: poll.question.text,
      finalized: poll.results?.is_finalized ?? false,
      answers: (poll.answers ?? []).map((a) => {
        const resultEntry = poll.results?.answer_counts?.find(
          (r) => r.id === a.answer_id
        );
        return {
          id: a.answer_id,
          text: a.poll_media.text,
          emoji: a.poll_media.emoji ?? null,
          count: resultEntry?.count ?? 0,
          meVoted: resultEntry?.me_voted ?? false,
        };
      }),
    };
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  /**
   * @private
   */
  _resolveEmoji(emoji) {
    if (typeof emoji === 'string') {
      // Unicode emoji
      return { name: emoji };
    }
    if (emoji.id) {
      // Custom emoji
      return { id: emoji.id, name: emoji.name ?? null };
    }
    return { name: emoji.name };
  }
}

module.exports = { PollManager };

/**
 * @typedef {Object} PollData
 * @property {string} question - The poll question (max 300 chars)
 * @property {(string | { text: string, emoji?: string | { id?: string, name?: string } })[]} answers - Array of answer options (2–10)
 * @property {number} [duration=24] - Duration in hours (1–168)
 * @property {boolean} [allowMultiselect=false] - Whether users can vote for multiple answers
 * @property {1} [layoutType=1] - Layout type (currently only 1 = DEFAULT is supported)
 */

/**
 * @typedef {Object} PollResults
 * @property {string} question
 * @property {boolean} finalized
 * @property {{ id: number, text: string, emoji: Object|null, count: number, meVoted: boolean }[]} answers
 */
