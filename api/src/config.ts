import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface DatabaseConfig {
  /** a ready connection string (local development, tests) — when set, nothing is created */
  url: string | null;
  /** the server's superuser connection (Railway: the Postgres service's DATABASE_URL), used once to create the
   *  mystic database and its role; the app itself then connects as that role */
  adminUrl: string | null;
  name: string;
  user: string;
  password: string | null;
  /** false: plain connection · 'verify': TLS with certificate check · 'no-verify': TLS, self-signed allowed */
  ssl: false | 'verify' | 'no-verify';
}

export interface AppConfig {
  port: number;
  db: DatabaseConfig;
  corsOrigins: string[] | true;
  /** optional: when set, writes and private reads need it (X-Admin-Token) */
  adminToken: string | null;
  /** shared with Sonic Hub: it signs pushes both ways (X-Sync-Token) */
  syncToken: string | null;
  sonicHub: { apiUrl: string | null };
  /** where profiles are opened, for links in briefs */
  publicWebUrl: string | null;
  ai: { apiKey: string | null; model: string; maxTokens: number };
  kbBundleDir: string;
  /** where the Nhân số học bundle is, when it is on disk (its text is not in the repository: else it is uploaded) */
  numerologyBundleDir: string;
  ownerName: string;
  /** sends briefs in the background; off in tests */
  syncWorker: boolean;
}

const here = dirname(fileURLToPath(import.meta.url));
/** sonic-mystic/ (this file runs from api/dist or api/dist-test/src) */
export const repoRoot = resolve(here, here.includes('dist-test') ? '../../..' : '../..');

function opt(env: NodeJS.ProcessEnv, name: string): string | null {
  const v = env[name]?.trim();
  return v ? v : null;
}

function ssl(env: NodeJS.ProcessEnv): DatabaseConfig['ssl'] {
  const v = (env.DATABASE_SSL ?? '').trim().toLowerCase();
  if (v === 'true' || v === 'verify') return 'verify';
  if (v === 'no-verify') return 'no-verify';
  return false;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const cors = opt(env, 'CORS_ORIGINS');
  const db: DatabaseConfig = {
    url: opt(env, 'DATABASE_URL'),
    adminUrl: opt(env, 'DATABASE_ADMIN_URL'),
    name: opt(env, 'MYSTIC_DB_NAME') ?? 'mystic',
    user: opt(env, 'MYSTIC_DB_USER') ?? 'mystic_app',
    password: opt(env, 'MYSTIC_DB_PASSWORD'),
    ssl: ssl(env),
  };
  if (!db.url && !(db.adminUrl && db.password)) {
    throw new Error('Set DATABASE_URL, or DATABASE_ADMIN_URL with MYSTIC_DB_PASSWORD (the database and its role are then created)');
  }
  return {
    port: Number(env.PORT ?? 3000),
    db,
    corsOrigins: !cors || cors === '*' ? true : cors.split(',').map(s => s.trim()).filter(Boolean),
    adminToken: opt(env, 'ADMIN_TOKEN'),
    syncToken: opt(env, 'SYNC_TOKEN'),
    sonicHub: { apiUrl: opt(env, 'SONIC_HUB_API_URL')?.replace(/\/$/, '') ?? null },
    publicWebUrl: opt(env, 'PUBLIC_WEB_URL')?.replace(/\/$/, '') ?? null,
    ai: { apiKey: opt(env, 'ANTHROPIC_API_KEY'), model: opt(env, 'ANTHROPIC_MODEL') ?? 'claude-sonnet-5-5', maxTokens: Number(env.AI_MAX_TOKENS ?? 16000) },
    kbBundleDir: opt(env, 'KB_BUNDLE_DIR') ?? resolve(repoRoot, 'kb/bundle'),
    numerologyBundleDir: opt(env, 'NUMEROLOGY_BUNDLE_DIR') ?? resolve(opt(env, 'KB_BUNDLE_DIR') ?? resolve(repoRoot, 'kb/bundle'), 'numerology'),
    ownerName: opt(env, 'OWNER_NAME') ?? 'Chủ nhà',
    syncWorker: (env.SYNC_WORKER ?? 'true') !== 'false',
  };
}
