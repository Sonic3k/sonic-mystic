import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle, type NodePgDatabase, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import pg from 'pg';
import type { DatabaseConfig } from '../config.js';
import * as schema from './schema.js';

export type Schema = typeof schema;
export type Db = NodePgDatabase<Schema>;
/** a database handle or an open transaction */
export type DbExecutor = PgDatabase<NodePgQueryResultHKT, Schema>;

export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

const sslOf = (ssl: DatabaseConfig['ssl']) => (ssl === false ? undefined : { rejectUnauthorized: ssl === 'verify' });

export function createPool(url: string, ssl: DatabaseConfig['ssl']): pg.Pool {
  return new pg.Pool({ connectionString: url, max: 8, ssl: sslOf(ssl) });
}

export function createDb(pool: pg.Pool): Db {
  return drizzle(pool, { schema });
}

const here = dirname(fileURLToPath(import.meta.url));
/** api/drizzle — from api/dist/db or api/dist-test/src/db */
const migrationsFolder = resolve(here, here.includes('dist-test') ? '../../../drizzle' : '../../drizzle');

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder, migrationsSchema: 'public', migrationsTable: '__drizzle_migrations' });
}

const ident = (s: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`Not a safe identifier: ${s}`);
  return `"${s}"`;
};
const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;

/**
 * Makes sure the mystic database and its role exist on the shared server, then returns the role's connection string.
 * Runs as the server's superuser (DATABASE_ADMIN_URL) on every start; it only creates what is missing and keeps the
 * role's password in step with MYSTIC_DB_PASSWORD. The role owns its database and nothing else: it cannot read Sonic Hub.
 */
export async function ensureDatabase(cfg: DatabaseConfig): Promise<string> {
  if (cfg.url) return cfg.url;
  if (!cfg.adminUrl || !cfg.password) throw new Error('DATABASE_ADMIN_URL and MYSTIC_DB_PASSWORD are needed to create the database');
  const admin = new pg.Client({ connectionString: cfg.adminUrl, ssl: sslOf(cfg.ssl) });
  await admin.connect();
  try {
    const role = await admin.query('select 1 from pg_roles where rolname = $1', [cfg.user]);
    if (!role.rowCount) await admin.query(`create role ${ident(cfg.user)} login password ${literal(cfg.password)}`);
    else await admin.query(`alter role ${ident(cfg.user)} with login password ${literal(cfg.password)}`);
    const db = await admin.query('select 1 from pg_database where datname = $1', [cfg.name]);
    if (!db.rowCount) {
      await admin.query(`create database ${ident(cfg.name)} owner ${ident(cfg.user)}`);
      await admin.query(`revoke all on database ${ident(cfg.name)} from public`);
      await admin.query(`grant connect, temporary on database ${ident(cfg.name)} to ${ident(cfg.user)}`);
    }
  } finally {
    await admin.end();
  }
  const url = new URL(cfg.adminUrl);
  url.username = encodeURIComponent(cfg.user);
  url.password = encodeURIComponent(cfg.password);
  url.pathname = `/${cfg.name}`;
  return url.toString();
}
