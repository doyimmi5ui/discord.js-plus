import { Client, TextChannel, DMChannel, Collection } from 'discord.js';
import { EventEmitter } from 'events';

// ─── PollManager ──────────────────────────────────────────────────────────────

export interface PollAnswerData {
  text: string;
  emoji?: string | { id?: string; name?: string };
}

export interface PollData {
  question: string;
  answers: (string | PollAnswerData)[];
  duration?: number;
  allowMultiselect?: boolean;
  layoutType?: 1;
}

export interface PollResultAnswer {
  id: number;
  text: string;
  emoji: object | null;
  count: number;
  meVoted: boolean;
}

export interface PollResults {
  question: string;
  finalized: boolean;
  answers: PollResultAnswer[];
}

export class PollManager {
  constructor(client: Client);
  client: Client;
  create(channelId: string, data: PollData): Promise<object>;
  end(channelId: string, messageId: string): Promise<object>;
  getVoters(channelId: string, messageId: string, answerId: number, options?: { limit?: number; after?: string }): Promise<object[]>;
  getResults(channelId: string, messageId: string): Promise<PollResults>;
}

// ─── PollBuilder ─────────────────────────────────────────────────────────────

export class PollBuilder {
  constructor();
  setQuestion(question: string): this;
  addAnswer(text: string, emoji?: string | object): this;
  setAnswers(answers: string[]): this;
  setDuration(hours: number): this;
  allowMultiselect(value?: boolean): this;
  build(): PollData;
  toJSON(): string;
}

// ─── SoundboardManager ───────────────────────────────────────────────────────

export interface SoundboardSound {
  sound_id: string;
  name: string;
  volume: number;
  emoji_id: string | null;
  emoji_name: string | null;
  guild_id: string | null;
  available: boolean;
  user: object | null;
}

export interface CreateSoundData {
  name: string;
  sound: string;
  volume?: number;
  emojiId?: string;
  emojiName?: string;
}

export class SoundboardManager {
  constructor(client: Client);
  client: Client;
  getDefaultSounds(): Promise<SoundboardSound[]>;
  getGuildSounds(guildId: string): Promise<SoundboardSound[]>;
  getGuildSound(guildId: string, soundId: string): Promise<SoundboardSound>;
  create(guildId: string, data: CreateSoundData): Promise<SoundboardSound>;
  edit(guildId: string, soundId: string, data: Partial<CreateSoundData>): Promise<SoundboardSound>;
  delete(guildId: string, soundId: string): Promise<void>;
  sendSound(channelId: string, soundId: string, sourceGuildId?: string): void;
}

// ─── ApplicationEmojiManager ─────────────────────────────────────────────────

export interface ApplicationEmoji {
  id: string;
  name: string;
  animated: boolean;
  managed: boolean;
  user: object | null;
}

export interface CreateApplicationEmojiData {
  name: string;
  image: string;
}

export class ApplicationEmojiManager {
  constructor(client: Client);
  client: Client;
  fetchAll(): Promise<ApplicationEmoji[]>;
  fetch(emojiId: string): Promise<ApplicationEmoji>;
  create(data: CreateApplicationEmojiData): Promise<ApplicationEmoji>;
  edit(emojiId: string, newName: string): Promise<ApplicationEmoji>;
  delete(emojiId: string): Promise<void>;
  toString(emoji: ApplicationEmoji): string;
}

// ─── GuildOnboardingManager ──────────────────────────────────────────────────

export interface GuildOnboarding {
  guild_id: string;
  prompts: object[];
  default_channel_ids: string[];
  enabled: boolean;
  mode: 0 | 1;
}

export interface EditOnboardingData {
  prompts?: object[];
  defaultChannelIds?: string[];
  enabled?: boolean;
  mode?: 0 | 1;
}

export class GuildOnboardingManager {
  constructor(client: Client);
  client: Client;
  fetch(guildId: string): Promise<GuildOnboarding>;
  edit(guildId: string, data: EditOnboardingData): Promise<GuildOnboarding>;
  addDefaultChannel(guildId: string, channelId: string): Promise<GuildOnboarding>;
  removeDefaultChannel(guildId: string, channelId: string): Promise<GuildOnboarding>;
}

// ─── ForumTagManager ─────────────────────────────────────────────────────────

export interface ForumTag {
  id: string;
  name: string;
  moderated: boolean;
  emoji_id: string | null;
  emoji_name: string | null;
}

export interface CreateTagData {
  name: string;
  moderated?: boolean;
  emojiId?: string;
  emojiName?: string;
}

export class ForumTagManager {
  constructor(client: Client);
  client: Client;
  fetchAll(channelId: string): Promise<ForumTag[]>;
  addTag(channelId: string, tagData: CreateTagData): Promise<ForumTag[]>;
  removeTag(channelId: string, tagId: string): Promise<ForumTag[]>;
  editTag(channelId: string, tagId: string, data: Partial<CreateTagData>): Promise<ForumTag[]>;
  reorderTags(channelId: string, tagIdOrder: string[]): Promise<ForumTag[]>;
  setThreadTags(threadId: string, tagIds: string[]): Promise<object>;
}

// ─── VoiceMessageBuilder ─────────────────────────────────────────────────────

export class VoiceMessageBuilder {
  constructor();
  setAudio(buffer: Buffer): this;
  setDuration(seconds: number): this;
  setWaveform(waveform: string): this;
  generateWaveform(amplitudes: number[]): this;
  build(): object;
  sendTo(channel: TextChannel | DMChannel): Promise<object>;
}

// ─── SafeCollector ───────────────────────────────────────────────────────────

export interface SafeCollectorOptions<T> {
  time?: number;
  idle?: number;
  max?: number;
  filter?: (item: T) => boolean | Promise<boolean>;
}

export class SafeCollector<T = unknown> extends EventEmitter {
  constructor(client: Client, options?: SafeCollectorOptions<T>);
  client: Client;
  collected: Map<string, T>;
  ended: boolean;
  start(event: string, keyResolver: (item: T) => string): this;
  stop(reason?: string): void;
  awaitEnd(): Promise<Map<string, T>>;
  on(event: 'collect', listener: (item: T) => void): this;
  on(event: 'end', listener: (collected: Map<string, T>, reason: string) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
}

// ─── RateLimitQueue ──────────────────────────────────────────────────────────

export interface RateLimitQueueOptions {
  maxRetries?: number;
  baseDelay?: number;
  concurrency?: number;
  onRateLimit?: (info: { retryAfter: number; entry: object }) => void;
}

export interface EnqueueOptions {
  priority?: 'high' | 'normal' | 'low';
  label?: string;
}

export interface QueueStats {
  total: number;
  success: number;
  rateLimited: number;
  failed: number;
  pending: number;
  active: number;
}

export class RateLimitQueue extends EventEmitter {
  constructor(options?: RateLimitQueueOptions);
  add<T>(fn: () => Promise<T>, options?: EnqueueOptions): Promise<T>;
  addAll<T>(fns: Array<() => Promise<T>>, options?: EnqueueOptions): Promise<T[]>;
  clear(): number;
  getStats(): QueueStats;
}

// ─── BurstReactionManager ────────────────────────────────────────────────────

export class BurstReactionManager {
  constructor(client: Client);
  client: Client;
  addBurstReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
  addNormalReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
  removeBurstReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
  getReactions(channelId: string, messageId: string, emoji: string, type?: 0 | 1, options?: { limit?: number; after?: string }): Promise<object[]>;
  getSummary(channelId: string, messageId: string): Promise<Record<string, object>>;
}

// ─── Patches ─────────────────────────────────────────────────────────────────

export function applyPatches(): void;

// ─── Collection extensions (added by applyPatches) ───────────────────────────

declare module 'discord.js' {
  interface Collection<K, V> {
    findAll(fn: (value: V) => boolean): V[];
    random(count?: number): V | V[];
    groupBy(fn: (value: V) => string): Record<string, V[]>;
  }

  interface Message {
    awaitReactions(options?: object): Promise<Collection<string, object>>;
    safeCrosspost(): Promise<Message | null>;
  }

  interface GuildMember {
    guildBannerURL(options?: { size?: number; format?: string }): string | null;
  }

  interface BaseInteraction {
    isFromGuild(): boolean;
    readonly resolvedLocale: string;
  }

  interface TextChannel {
    sendTypingFor(durationMs: number): { stop(): void };
  }

  interface DMChannel {
    sendTypingFor(durationMs: number): { stop(): void };
  }

  interface ThreadChannel {
    sendTypingFor(durationMs: number): { stop(): void };
  }
}

export const version: string;
