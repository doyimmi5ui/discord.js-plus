'use strict';

/**
 * Fluent builder for creating Discord Polls.
 * Use together with PollManager to send polls.
 *
 * @example
 * const poll = new PollBuilder()
 *   .setQuestion('What is your favorite framework?')
 *   .addAnswer('React', '⚛️')
 *   .addAnswer('Vue', '💚')
 *   .addAnswer('Svelte', '🧡')
 *   .setDuration(48)
 *   .allowMultiselect()
 *   .build();
 *
 * await pollManager.create(channelId, poll);
 */
class PollBuilder {
  constructor() {
    /** @private */
    this._question = null;
    /** @private */
    this._answers = [];
    /** @private */
    this._duration = 24;
    /** @private */
    this._allowMultiselect = false;
    /** @private */
    this._layoutType = 1;
  }

  /**
   * Sets the poll question.
   * @param {string} question - Max 300 characters
   * @returns {this}
   */
  setQuestion(question) {
    if (typeof question !== 'string' || question.length === 0) {
      throw new Error('[discordjs-plus] PollBuilder#setQuestion: question must be a non-empty string.');
    }
    if (question.length > 300) {
      throw new Error('[discordjs-plus] PollBuilder#setQuestion: question cannot exceed 300 characters.');
    }
    this._question = question;
    return this;
  }

  /**
   * Adds an answer option to the poll.
   * @param {string} text - The answer text (max 55 chars)
   * @param {string|{ id?: string, name?: string }} [emoji] - Optional emoji
   * @returns {this}
   *
   * @example
   * builder.addAnswer('JavaScript')
   * builder.addAnswer('TypeScript', '🔷')
   * builder.addAnswer('Custom Emoji', { id: '123', name: 'myEmoji' })
   */
  addAnswer(text, emoji) {
    if (typeof text !== 'string' || text.length === 0) {
      throw new Error('[discordjs-plus] PollBuilder#addAnswer: text must be a non-empty string.');
    }
    if (text.length > 55) {
      throw new Error('[discordjs-plus] PollBuilder#addAnswer: answer text cannot exceed 55 characters.');
    }
    if (this._answers.length >= 10) {
      throw new Error('[discordjs-plus] PollBuilder#addAnswer: Cannot add more than 10 answers to a poll.');
    }

    this._answers.push(emoji ? { text, emoji } : text);
    return this;
  }

  /**
   * Sets multiple answers at once.
   * @param {string[]} answers
   * @returns {this}
   */
  setAnswers(answers) {
    if (!Array.isArray(answers)) {
      throw new Error('[discordjs-plus] PollBuilder#setAnswers: answers must be an array.');
    }
    this._answers = [];
    for (const answer of answers) {
      this.addAnswer(typeof answer === 'string' ? answer : answer.text, answer.emoji);
    }
    return this;
  }

  /**
   * Sets the poll duration in hours.
   * @param {number} hours - Must be between 1 and 168 (7 days)
   * @returns {this}
   */
  setDuration(hours) {
    if (typeof hours !== 'number' || hours < 1 || hours > 168) {
      throw new Error('[discordjs-plus] PollBuilder#setDuration: hours must be a number between 1 and 168.');
    }
    this._duration = hours;
    return this;
  }

  /**
   * Allows users to vote for multiple answers.
   * @param {boolean} [value=true]
   * @returns {this}
   */
  allowMultiselect(value = true) {
    this._allowMultiselect = value;
    return this;
  }

  /**
   * Validates and returns the poll data object for use with PollManager.
   * @returns {import('../structures/PollManager').PollData}
   */
  build() {
    if (!this._question) {
      throw new Error('[discordjs-plus] PollBuilder#build: Question is required. Call .setQuestion() first.');
    }
    if (this._answers.length < 2) {
      throw new Error('[discordjs-plus] PollBuilder#build: At least 2 answers are required. Call .addAnswer() more times.');
    }

    return {
      question: this._question,
      answers: this._answers,
      duration: this._duration,
      allowMultiselect: this._allowMultiselect,
      layoutType: this._layoutType,
    };
  }

  /**
   * Returns a JSON representation of the poll (useful for debugging).
   * @returns {string}
   */
  toJSON() {
    return JSON.stringify(this.build(), null, 2);
  }
}

module.exports = { PollBuilder };
