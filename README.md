# discordjs-plus

> Extensions, bug fixes, and missing Discord API features for **discord.js v14**.

[![npm](https://img.shields.io/npm/v/discordjs-plus)](https://www.npmjs.com/package/discordjs-plus)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## ⚠️ Compatibility Notice (important — please read)

We keep this table updated as discord.js evolves:

| Feature | discord.js native | Status in this lib |
|---|---|---|
| `PollManager` | ✅ Added in **v14.15.0** | Backport for `< 14.15.0` + extra utilities (voters, raw results) |
| `ApplicationEmojiManager` | ✅ Added in **v14.16.0** | Backport for `< 14.16.0` + `toString()` helper |
| `SoundboardManager` | ✅ Added in **v14.16+** | Backport for older versions |
| `ForumTagManager` (atomic ops) | ❌ Never added | Always useful — DJS still requires full-array re-send |
| `awaitReactions idle` bug | 🐛 **Still broken** ([#11286](https://github.com/discordjs/discord.js/issues/11286), Nov 2025) | Fixed via `applyPatches()` |
| Collector `MaxListenersExceededWarning` | 🐛 **Ongoing** ([#4626](https://github.com/discordjs/discord.js/issues/4626)) | Fixed via `SafeCollector` |
| `BurstReactionManager` (type param) | ❌ Not exposed | Always useful |
| `RateLimitQueue` | ❌ Not provided | Always useful |
| `Collection#findAll / groupBy / random` | ❌ Not provided | Always useful via `applyPatches()` |
| `GuildMember#guildBannerURL` | ❌ Not provided | Always useful via `applyPatches()` |
| `channel.sendTypingFor(ms)` | ❌ Not provided | Always useful via `applyPatches()` |

**TL;DR:** If you're on discord.js ≥ 14.16.0, the bug fixes, `ForumTagManager`, `SafeCollector`, `RateLimitQueue`, and `BurstReactionManager` are the main reasons to use this lib. The Polls/Emoji/Soundboard classes are a bonus for older versions or for the extra utilities they expose.

---

## Why does this exist?

discord.js is a great library, but it has real, confirmed gaps:

- **`awaitReactions idle`** — Ignored since v11, still broken as of November 2025 ([issue #11286](https://github.com/discordjs/discord.js/issues/11286))
- **`MaxListenersExceededWarning`** — One of the most common discord.js issues, caused by collectors not cleaning up properly ([issue #4626](https://github.com/discordjs/discord.js/issues/4626), [#3943](https://github.com/discordjs/discord.js/issues/3943))
- **Forum tags replace-all** — `channel.edit({ availableTags: [...] })` silently deletes any tag not included in the array. No atomic add/remove exists natively.
- **Forum tag duplicates** — The Discord API accepts duplicate tag IDs, a confirmed API bug in [discord-api-docs #5408](https://github.com/discord/discord-api-docs/issues/5408). Our `ForumTagManager#setThreadTags` deduplicates automatically.
- **Burst reactions** — The `type` query parameter for super reactions is not exposed in discord.js's `MessageReaction` methods.
- **Application Emojis backport** — Only added to discord.js in v14.16.0 after community request in [issue #10396](https://github.com/discordjs/discord.js/issues/10396) (July 2024).

---

## Installation

```bash
npm install discordjs-plus
# discord.js must be installed as a peer dependency
npm install discord.js
```

---

## Quick Start

```js
const { Client, GatewayIntentBits } = require('discord.js');
const {
  applyPatches,
  PollManager,
  PollBuilder,
  SoundboardManager,
  ApplicationEmojiManager,
  ForumTagManager,
  SafeCollector,
  RateLimitQueue,
  BurstReactionManager,
} = require('discordjs-plus');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  // Apply bug fixes and extensions to discord.js classes
  applyPatches();
  console.log(`Logged in as ${client.user.tag}`);
});

client.login('YOUR_TOKEN');
```

---

## API Reference

### `applyPatches()`

Applies all bug fixes and extensions to discord.js classes. Call this once when your bot is ready.

**What it patches:**

- `Collection#findAll(fn)` — finds all matching items (not just the first)
- `Collection#random(n)` — returns N random items
- `Collection#groupBy(fn)` — groups items by a key
- `Message#awaitReactions` — fixes the `idle` option being ignored
- `Message#safeCrosspost()` — crossposts without throwing if channel isn't announcement
- `GuildMember#guildBannerURL(options)` — returns guild-specific member banner URL
- `BaseInteraction#isFromGuild()` — returns `true` if interaction is from a guild
- `BaseInteraction#resolvedLocale` — locale with fallback chain (`locale → guildLocale → 'en-US'`)
- `TextChannel#sendTypingFor(ms)` — sends typing indicator for a duration

```js
applyPatches();

// Now available:
const onlineMembers = guild.members.cache.findAll(m => m.presence?.status === 'online');
const fiveRandom = guild.members.cache.random(5);
const byRole = guild.members.cache.groupBy(m => m.roles.highest.name);

const banner = member.guildBannerURL({ size: 1024 });

const typing = channel.sendTypingFor(10_000);
await doHeavyWork();
typing.stop();
```

---

### `PollManager`

Full Discord Polls API support — create polls, end them early, get results, and fetch voters.

```js
const pollManager = new PollManager(client);

// Create a poll
const message = await pollManager.create('channelId', {
  question: 'What is your favorite language?',
  answers: [
    'JavaScript',
    { text: 'TypeScript', emoji: '🔷' },
    { text: 'Python', emoji: '🐍' },
  ],
  duration: 24,            // hours (1–168)
  allowMultiselect: false,
});

// Get results
const results = await pollManager.getResults('channelId', message.id);
console.log(results.answers); // [{ id: 1, text: 'JavaScript', count: 42, ... }]

// Get voters for answer #1
const voters = await pollManager.getVoters('channelId', message.id, 1, { limit: 100 });

// End poll early
await pollManager.end('channelId', message.id);
```

---

### `PollBuilder`

Fluent builder for poll configuration. Use with `PollManager#create`.

```js
const poll = new PollBuilder()
  .setQuestion('Best JS framework?')
  .addAnswer('React', '⚛️')
  .addAnswer('Vue', '💚')
  .addAnswer('Svelte', '🧡')
  .setDuration(48)
  .allowMultiselect()
  .build();

await pollManager.create('channelId', poll);
```

---

### `SoundboardManager`

Create, edit, delete, and send soundboard sounds. 100% of the Discord Soundboard API.

```js
const soundboard = new SoundboardManager(client);

// List default Discord sounds
const defaults = await soundboard.getDefaultSounds();

// List guild sounds
const guildSounds = await soundboard.getGuildSounds('guildId');

// Create a sound (OGG Opus, max 512KB)
const fs = require('fs');
const newSound = await soundboard.create('guildId', {
  name: 'my-sound',
  sound: `data:audio/ogg;base64,${fs.readFileSync('./sound.ogg').toString('base64')}`,
  volume: 0.8,
  emojiName: '🔊',
});

// Edit a sound
await soundboard.edit('guildId', newSound.sound_id, { volume: 1.0 });

// Delete a sound
await soundboard.delete('guildId', newSound.sound_id);
```

---

### `ApplicationEmojiManager`

Manage emojis tied to your application (usable anywhere, no Nitro required for bots).

```js
const emojiManager = new ApplicationEmojiManager(client);

// List all app emojis
const emojis = await emojiManager.fetchAll();

// Create an emoji
const fs = require('fs');
const emoji = await emojiManager.create({
  name: 'my_logo',
  image: `data:image/png;base64,${fs.readFileSync('./logo.png').toString('base64')}`,
});

// Use in a message
await channel.send(`Check this out: ${emojiManager.toString(emoji)}`);

// Edit or delete
await emojiManager.edit(emoji.id, 'new_name');
await emojiManager.delete(emoji.id);
```

---

### `ForumTagManager`

Atomic forum tag operations — no more accidentally deleting all tags on edit.

```js
const tagManager = new ForumTagManager(client);

// ✅ Safe: adds tag without affecting existing tags
await tagManager.addTag('forumChannelId', {
  name: 'Bug Report',
  emojiName: '🐛',
  moderated: false,
});

// ✅ Safe: removes only the specified tag
await tagManager.removeTag('forumChannelId', 'tagId');

// ✅ Safe: edits only the specified tag
await tagManager.editTag('forumChannelId', 'tagId', {
  name: 'Critical Bug',
  emojiName: '🔴',
});

// Reorder tags
await tagManager.reorderTags('forumChannelId', ['tagId3', 'tagId1', 'tagId2']);

// Apply tags to a thread (max 5)
await tagManager.setThreadTags('threadId', ['tagId1', 'tagId2']);
```

---

### `SafeCollector`

A memory-leak-safe replacement for discord.js collectors.

**What's fixed:**
- Properly removes event listeners on `.stop()`
- `setMaxListeners` is managed automatically — no more `MaxListenersExceededWarning`
- Timers use `.unref()` so the process can exit cleanly
- Supports `idle` timeout (resets on each event)

```js
const collector = new SafeCollector(client, {
  time: 30_000,    // end after 30 seconds
  idle: 5_000,     // end after 5 seconds of no new items
  max: 10,         // end after 10 items collected
  filter: (interaction) => interaction.channelId === targetChannelId,
});

collector
  .start('interactionCreate', (i) => i.id)
  .on('collect', (item) => console.log('Got:', item.id))
  .on('end', (collected, reason) => console.log(`Ended (${reason}): ${collected.size} items`));

// Or await all results
const results = await collector.awaitEnd();
```

---

### `RateLimitQueue`

Priority queue with automatic retry for Discord REST rate limits.

```js
const queue = new RateLimitQueue({
  baseDelay: 50,     // 50ms between each request
  maxRetries: 3,     // retry up to 3 times on 429
  concurrency: 1,    // 1 request at a time (safest)
});

queue.on('rateLimited', ({ retryAfter }) => {
  console.log(`Rate limited! Retrying in ${retryAfter}ms`);
});

// All these will be queued safely
const channels = await queue.addAll(
  channelIds.map(id => () => client.channels.fetch(id))
);

// High-priority task runs first
await queue.add(() => importantRequest(), { priority: 'high' });

// Check stats
console.log(queue.getStats());
// { total: 50, success: 49, rateLimited: 1, failed: 0, pending: 0, active: 0 }
```

---

### `BurstReactionManager`

Adds Discord Super Reaction (burst reaction) support not available in discord.js.

```js
const burst = new BurstReactionManager(client);

// Add a super reaction (requires Nitro on the bot account)
await burst.addBurstReaction('channelId', 'messageId', '⭐');

// Add a normal reaction explicitly
await burst.addNormalReaction('channelId', 'messageId', '⭐');

// Remove a super reaction
await burst.removeBurstReaction('channelId', 'messageId', '⭐');

// Get users who super-reacted (type=1) vs normal-reacted (type=0)
const superVoters = await burst.getReactions('channelId', 'messageId', '⭐', 1);

// Get a full summary of all reaction types
const summary = await burst.getSummary('channelId', 'messageId');
// { '⭐': { normal: 5, burst: 2, total: 7, burstColors: ['#FFD700'] }, ... }
```

---

### `VoiceMessageBuilder`

Build and send voice messages (the blue waveform messages).

```js
const { VoiceMessageBuilder } = require('discordjs-plus');
const fs = require('fs');

const builder = new VoiceMessageBuilder()
  .setAudio(fs.readFileSync('./recording.ogg'))  // OGG Opus format
  .setDuration(5.2)                               // seconds
  .generateWaveform(new Array(256).fill(0).map(() => Math.random() * 255));

// Send via raw REST (bypasses discord.js to set voice message flag correctly)
await builder.sendTo(channel);
```

---

## Contributing

Pull requests are welcome! Please open an issue first to discuss what you'd like to change.

```bash
git clone https://github.com/your-username/discordjs-plus
cd discordjs-plus
npm install
```

---

## License

[MIT](./LICENSE)

---

*Maintained by the community. Not affiliated with Discord or the discord.js team.*
