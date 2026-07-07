import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const SETTINGS_KEY = 'teledrive:settings';

const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? '';
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '';

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

export type RuntimeSettings = {
  appPasswordHash?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  updatedAt?: string;
};

export type EffectiveSettings = {
  database: {
    configured: boolean;
    urlSet: boolean;
    tokenSet: boolean;
  };
  appPassword: {
    configured: boolean;
    source: 'runtime' | 'env' | 'none';
  };
  telegram: {
    configured: boolean;
    botToken: string;
    chatId: string;
    source: 'runtime' | 'env' | 'mixed' | 'none';
  };
};

function safeSettings(value: unknown): RuntimeSettings {
  if (!value) return {};
  if (typeof value === 'object') return value as RuntimeSettings;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as RuntimeSettings;
    } catch {
      return {};
    }
  }
  return {};
}

function passwordHash(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function isDatabaseConfigured(): boolean {
  return Boolean(redis);
}

export async function getRuntimeSettings(): Promise<RuntimeSettings> {
  if (!redis) return {};
  const value = await redis.get(SETTINGS_KEY);
  return safeSettings(value);
}

export async function saveRuntimeSettings(patch: {
  appPassword?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}): Promise<RuntimeSettings> {
  if (!redis) {
    throw new Error('Database belum dikonfigurasi.');
  }

  const current = await getRuntimeSettings();
  const next: RuntimeSettings = {
    ...current,
    updatedAt: new Date().toISOString(),
  };

  if (patch.appPassword !== undefined && patch.appPassword.trim()) {
    next.appPasswordHash = passwordHash(patch.appPassword.trim());
  }
  if (patch.telegramBotToken !== undefined && patch.telegramBotToken.trim()) {
    next.telegramBotToken = patch.telegramBotToken.trim();
  }
  if (patch.telegramChatId !== undefined && patch.telegramChatId.trim()) {
    next.telegramChatId = patch.telegramChatId.trim();
  }

  await redis.set(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export async function getAppPasswordHash(): Promise<string | null> {
  const runtime = await getRuntimeSettings();
  if (runtime.appPasswordHash) return runtime.appPasswordHash;
  const envPassword = process.env.APP_PASSWORD;
  return envPassword ? passwordHash(envPassword) : null;
}

export async function getEffectiveSettings(): Promise<EffectiveSettings> {
  const runtime = await getRuntimeSettings();
  const envBotToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const envChatId = process.env.TELEGRAM_CHAT_ID ?? '';
  const botToken = runtime.telegramBotToken || envBotToken;
  const chatId = runtime.telegramChatId || envChatId;
  const runtimeTelegram = Boolean(runtime.telegramBotToken || runtime.telegramChatId);
  const envTelegram = Boolean(envBotToken || envChatId);

  return {
    database: {
      configured: Boolean(redis),
      urlSet: Boolean(redisUrl),
      tokenSet: Boolean(redisToken),
    },
    appPassword: {
      configured: Boolean(runtime.appPasswordHash || process.env.APP_PASSWORD),
      source: runtime.appPasswordHash ? 'runtime' : process.env.APP_PASSWORD ? 'env' : 'none',
    },
    telegram: {
      configured: Boolean(botToken && chatId),
      botToken,
      chatId,
      source: runtimeTelegram && envTelegram ? 'mixed' : runtimeTelegram ? 'runtime' : envTelegram ? 'env' : 'none',
    },
  };
}

export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '********';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
