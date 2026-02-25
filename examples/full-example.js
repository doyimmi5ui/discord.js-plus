/**
 * discordjs-plus — Full Usage Example
 * Run: node examples/full-example.js
 *
 * Make sure to set your BOT_TOKEN in .env or replace it below.
 */

'use strict';

const { Client, GatewayIntentBits, Events } = require('discord.js');
const {
  applyPatches,
  PollManager,
  PollBuilder,
  SoundboardManager,
  ApplicationEmojiManager,
  ForumTagManager,
  GuildOnboardingManager,
  SafeCollector,
  RateLimitQueue,
  BurstReactionManager,
} = require('discordjs-plus');

const TOKEN = process.env.BOT_TOKEN ?? 'YOUR_TOKEN_HERE';
const CHANNEL_ID = process.env.CHANNEL_ID ?? 'YOUR_CHANNEL_ID';
const GUILD_ID = process.env.GUILD_ID ?? 'YOUR_GUILD_ID';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);

  // ─── Apply all patches first ────────────────────────────────────────────
  applyPatches();

  // ─── Test Collection extensions ─────────────────────────────────────────
  const guild = client.guilds.cache.first();
  if (guild) {
    await guild.members.fetch();

    const botMembers = guild.members.cache.findAll((m) => m.user.bot);
    console.log(`🤖 Bots in server: ${botMembers.length}`);

    const randomMember = guild.members.cache.random();
    console.log(`🎲 Random member: ${randomMember?.user.username}`);

    const byRole = guild.members.cache.groupBy((m) => m.roles.highest.name);
    console.log(`📦 Members grouped by highest role:`, Object.keys(byRole));
  }

  // ─── PollBuilder + PollManager ──────────────────────────────────────────
  console.log('\n📊 Testing PollManager...');
  const pollManager = new PollManager(client);

  const pollData = new PollBuilder()
    .setQuestion('What feature should we add next?')
    .addAnswer('More commands', '⚡')
    .addAnswer('Better logging', '📋')
    .addAnswer('Dashboard', '🖥️')
    .setDuration(1) // 1 hour
    .allowMultiselect(false)
    .build();

  try {
    const pollMsg = await pollManager.create(CHANNEL_ID, pollData);
    console.log(`✅ Poll created! Message ID: ${pollMsg.id}`);

    // Wait a moment then get results
    setTimeout(async () => {
      const results = await pollManager.getResults(CHANNEL_ID, pollMsg.id);
      console.log('📈 Poll results:', results);

      // End early
      await pollManager.end(CHANNEL_ID, pollMsg.id);
      console.log('🛑 Poll ended early');
    }, 3000);
  } catch (err) {
    console.error('Poll error:', err.message);
  }

  // ─── ApplicationEmojiManager ────────────────────────────────────────────
  console.log('\n😀 Testing ApplicationEmojiManager...');
  const emojiManager = new ApplicationEmojiManager(client);

  try {
    const emojis = await emojiManager.fetchAll();
    console.log(`✅ App emojis: ${emojis.length}`);
    if (emojis.length > 0) {
      console.log(`  First: ${emojiManager.toString(emojis[0])}`);
    }
  } catch (err) {
    console.error('Emoji error:', err.message);
  }

  // ─── SoundboardManager ──────────────────────────────────────────────────
  console.log('\n🔊 Testing SoundboardManager...');
  const soundboard = new SoundboardManager(client);

  try {
    const defaults = await soundboard.getDefaultSounds();
    console.log(`✅ Default sounds: ${defaults.length}`);
    console.log('  Names:', defaults.slice(0, 3).map((s) => s.name).join(', '));
  } catch (err) {
    console.error('Soundboard error:', err.message);
  }

  // ─── BurstReactionManager ───────────────────────────────────────────────
  console.log('\n⭐ Testing BurstReactionManager...');
  const burst = new BurstReactionManager(client);

  try {
    // Send a test message first
    const channel = await client.channels.fetch(CHANNEL_ID);
    const testMsg = await channel.send('Testing burst reactions! ⭐');

    await burst.addNormalReaction(CHANNEL_ID, testMsg.id, '⭐');
    console.log('✅ Normal reaction added');

    const summary = await burst.getSummary(CHANNEL_ID, testMsg.id);
    console.log('📊 Reaction summary:', summary);
  } catch (err) {
    console.error('Burst reaction error:', err.message);
  }

  // ─── RateLimitQueue ─────────────────────────────────────────────────────
  console.log('\n⏱️ Testing RateLimitQueue...');
  const queue = new RateLimitQueue({ baseDelay: 100, maxRetries: 2 });

  queue.on('rateLimited', ({ retryAfter }) => {
    console.warn(`⚠️ Rate limited! Waiting ${retryAfter}ms`);
  });

  try {
    // Safely fetch multiple channels in sequence
    const channelIds = [CHANNEL_ID]; // Add more channel IDs to test queuing
    const channels = await queue.addAll(
      channelIds.map((id) => () => client.channels.fetch(id))
    );
    console.log(`✅ Fetched ${channels.length} channel(s) via queue`);
    console.log('📈 Queue stats:', queue.getStats());
  } catch (err) {
    console.error('Queue error:', err.message);
  }

  // ─── SafeCollector ──────────────────────────────────────────────────────
  console.log('\n🧹 Testing SafeCollector...');
  const channel = await client.channels.fetch(CHANNEL_ID);
  await channel.send('Send me 3 messages within 15 seconds! (SafeCollector test)');

  const collector = new SafeCollector(client, {
    time: 15_000,
    idle: 5_000,
    max: 3,
    filter: (msg) => msg.channelId === CHANNEL_ID && !msg.author.bot,
  });

  collector
    .start('messageCreate', (msg) => msg.id)
    .on('collect', (msg) => console.log(`  📨 Collected: "${msg.content}" from ${msg.author.username}`))
    .on('end', (collected, reason) => {
      console.log(`✅ Collector ended (${reason}) — ${collected.size} messages collected`);
      console.log('   All listeners properly cleaned up! No memory leak.');
      client.destroy();
    });

  // ─── sendTypingFor patch ────────────────────────────────────────────────
  const typing = channel.sendTypingFor(5000);
  console.log('\n⌨️ Typing for 5 seconds...');
  setTimeout(() => {
    typing.stop();
    console.log('  Typing stopped early!');
  }, 2000);
});

client.login(TOKEN).catch(console.error);
