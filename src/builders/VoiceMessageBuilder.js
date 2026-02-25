'use strict';

const { AttachmentBuilder } = require('discord.js');

/**
 * Builds and sends voice messages (the blue waveform messages).
 *
 * Voice messages are a Discord feature added in 2023. They are regular messages
 * with an attachment that has the IS_VOICE_MESSAGE (1 << 13) flag set.
 * discord.js does not provide a builder for this — bots can technically send them
 * via the raw API, though Discord recommends they remain user-only.
 *
 * This builder makes it easy to construct the correct payload.
 *
 * Note: Discord may reject voice messages from bots. Use this for testing
 * or in cases where Discord updates their policy.
 */
class VoiceMessageBuilder {
  constructor() {
    /**
     * @private
     * @type {Buffer|null}
     */
    this._audioBuffer = null;

    /**
     * @private
     * @type {number}
     */
    this._durationSecs = 0;

    /**
     * @private
     * @type {string}
     */
    this._waveform = '';

    /**
     * @private
     * @type {string}
     */
    this._filename = 'voice-message.ogg';
  }

  /**
   * Sets the raw audio buffer (must be OGG Opus encoded).
   * @param {Buffer} buffer
   * @returns {this}
   *
   * @example
   * builder.setAudio(fs.readFileSync('./recording.ogg'));
   */
  setAudio(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('[discordjs-plus] VoiceMessageBuilder#setAudio: buffer must be a Buffer.');
    }
    this._audioBuffer = buffer;
    return this;
  }

  /**
   * Sets the duration of the voice message in seconds.
   * @param {number} seconds
   * @returns {this}
   */
  setDuration(seconds) {
    if (typeof seconds !== 'number' || seconds <= 0) {
      throw new Error('[discordjs-plus] VoiceMessageBuilder#setDuration: seconds must be a positive number.');
    }
    this._durationSecs = seconds;
    return this;
  }

  /**
   * Sets a pre-computed waveform string (base64 encoded array of uint8 amplitudes, 256 values).
   * If not set, a flat waveform is generated automatically.
   *
   * @param {string} waveform - Base64 encoded waveform data
   * @returns {this}
   */
  setWaveform(waveform) {
    this._waveform = waveform;
    return this;
  }

  /**
   * Generates a waveform from a Buffer of PCM amplitude values (0–255).
   * Useful if you have raw audio data you want to visualize.
   *
   * @param {number[]} amplitudes - Array of 256 amplitude values (0–255)
   * @returns {this}
   */
  generateWaveform(amplitudes) {
    if (!Array.isArray(amplitudes) || amplitudes.length !== 256) {
      throw new Error('[discordjs-plus] VoiceMessageBuilder#generateWaveform: amplitudes must be an array of exactly 256 values (0–255).');
    }
    const clamped = amplitudes.map((v) => Math.max(0, Math.min(255, Math.round(v))));
    this._waveform = Buffer.from(new Uint8Array(clamped)).toString('base64');
    return this;
  }

  /**
   * Generates a flat (silent) waveform. Used as a default.
   * @private
   */
  _generateFlatWaveform() {
    const flat = new Uint8Array(256).fill(0);
    return Buffer.from(flat).toString('base64');
  }

  /**
   * Builds the message options object to pass to `channel.send()`.
   * @returns {VoiceMessagePayload}
   *
   * @example
   * const payload = new VoiceMessageBuilder()
   *   .setAudio(fs.readFileSync('./voice.ogg'))
   *   .setDuration(5.2)
   *   .build();
   *
   * await channel.send(payload);
   */
  build() {
    if (!this._audioBuffer) {
      throw new Error('[discordjs-plus] VoiceMessageBuilder#build: Audio buffer is required. Call .setAudio() first.');
    }

    const waveform = this._waveform || this._generateFlatWaveform();

    const attachment = new AttachmentBuilder(this._audioBuffer, {
      name: this._filename,
    });

    return {
      files: [attachment],
      // Raw flags payload — must be sent via REST directly since discord.js
      // does not support IS_VOICE_MESSAGE flag (1 << 13 = 8192) natively
      flags: 8192, // MessageFlags.IS_VOICE_MESSAGE
      // These fields are sent as part of the attachment in the raw API
      _voiceMessageMeta: {
        duration_secs: this._durationSecs,
        waveform: waveform,
      },
    };
  }

  /**
   * Sends the voice message to a channel directly using the raw REST API.
   * This bypasses discord.js message sending to properly set voice message flags.
   *
   * @param {import('discord.js').TextChannel | import('discord.js').DMChannel} channel
   * @returns {Promise<Object>} The created message
   *
   * @example
   * const builder = new VoiceMessageBuilder()
   *   .setAudio(audioBuffer)
   *   .setDuration(3.5);
   *
   * const message = await builder.sendTo(channel);
   */
  async sendTo(channel) {
    if (!channel?.id || !channel?.client?.rest) {
      throw new Error('[discordjs-plus] VoiceMessageBuilder#sendTo: channel must be a valid TextChannel.');
    }

    if (!this._audioBuffer) {
      throw new Error('[discordjs-plus] VoiceMessageBuilder#sendTo: Audio buffer is required. Call .setAudio() first.');
    }

    const waveform = this._waveform || this._generateFlatWaveform();

    const { FormData, File } = await import('node:buffer').catch(() => {
      throw new Error('[discordjs-plus] VoiceMessageBuilder#sendTo: Requires Node.js 18+');
    });

    const form = new FormData();

    const payload = JSON.stringify({
      flags: 8192,
      attachments: [
        {
          id: '0',
          filename: this._filename,
          duration_secs: this._durationSecs,
          waveform: waveform,
        },
      ],
    });

    form.append('payload_json', payload, { contentType: 'application/json' });
    form.append('files[0]', new Blob([this._audioBuffer], { type: 'audio/ogg' }), this._filename);

    return channel.client.rest.post(`/channels/${channel.id}/messages`, {
      body: form,
    });
  }
}

module.exports = { VoiceMessageBuilder };

/**
 * @typedef {Object} VoiceMessagePayload
 * @property {import('discord.js').AttachmentBuilder[]} files
 * @property {number} flags
 * @property {Object} _voiceMessageMeta
 */
