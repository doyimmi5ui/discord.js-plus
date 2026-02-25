'use strict';

/**
 * discordjs-plus
 * Extensions, fixes and missing Discord API features for discord.js
 * @version 1.0.0
 */

// Structures
const { PollManager } = require('./structures/PollManager');
const { SoundboardManager } = require('./structures/SoundboardManager');
const { ApplicationEmojiManager } = require('./structures/ApplicationEmojiManager');
const { GuildOnboardingManager } = require('./structures/GuildOnboardingManager');
const { ForumTagManager } = require('./structures/ForumTagManager');

// Builders
const { VoiceMessageBuilder } = require('./builders/VoiceMessageBuilder');
const { PollBuilder } = require('./builders/PollBuilder');

// Utils
const { SafeCollector } = require('./utils/SafeCollector');
const { RateLimitQueue } = require('./utils/RateLimitQueue');
const { BurstReactionManager } = require('./utils/BurstReactionManager');

// Patchers (apply fixes to discord.js)
const { applyPatches } = require('./patches/index');

module.exports = {
  // Structures
  PollManager,
  SoundboardManager,
  ApplicationEmojiManager,
  GuildOnboardingManager,
  ForumTagManager,

  // Builders
  VoiceMessageBuilder,
  PollBuilder,

  // Utils
  SafeCollector,
  RateLimitQueue,
  BurstReactionManager,

  // Patch applier
  applyPatches,

  // Version
  version: '1.0.0',
};
