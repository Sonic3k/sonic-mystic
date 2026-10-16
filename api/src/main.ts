import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import { pathToFileURL } from 'node:url';
import { AppModule } from './app.module.js';
import { loadConfig, type AppConfig } from './config.js';
import { createDb, createPool, ensureDatabase, runMigrations } from './db/db.js';
import { importTuvi, upsertDisciplines } from './kb/importer.js';
import { importNumerology, readNumerologyBundle } from './kb/numerology-importer.js';
import { importAstrology, readAstrologyBundle } from './kb/astrology-importer.js';

/** the database first (created on the shared server when missing), its schema, the knowledge, then the app */
export async function createApp(config: AppConfig): Promise<NestExpressApplication> {
  const log = new Logger('mystic-api');
  const url = await ensureDatabase(config.db);
  const pool = createPool(url, config.db.ssl);
  const db = createDb(pool);
  await runMigrations(db);
  // the disciplines the engine knows, and which of them are ready (an import may be skipped, this is not)
  await upsertDisciplines(db);
  const report = await importTuvi(db, config.kbBundleDir);
  log.log(report.skipped ? `knowledge ${report.version} already imported` : `imported knowledge ${report.version}: ${report.written} rows, ${report.keptEdited} edited kept, ${report.removed} removed (${report.ms} ms)`);
  // the numerology book, when its bundle is on disk (else it is uploaded: PUT /api/numerology/bundle)
  const nb = readNumerologyBundle(config.numerologyBundleDir);
  if (nb) {
    const r = await importNumerology(db, nb);
    log.log(r.skipped ? `numerology ${r.version} already imported` : `imported numerology ${r.version}: ${r.written} rows, ${r.keptEdited} edited kept, ${r.removed} removed (${r.ms} ms)`);
  } else log.log('numerology bundle not on disk: the book is loaded by upload');
  // the astrology sources, likewise (PUT /api/astrology/bundle)
  const ab = readAstrologyBundle(config.astrologyBundleDir);
  if (ab) {
    const r = await importAstrology(db, ab);
    log.log(r.skipped ? `astrology ${r.version} already imported` : `imported astrology ${r.version}: ${r.written} rows, ${r.keptEdited} edited kept, ${r.removed} removed (${r.ms} ms)`);
  } else log.log('astrology bundle not on disk: the sources are loaded by upload');
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config, pool), {
    logger: process.env.NODE_ENV === 'test' ? ['error'] : ['log', 'warn', 'error'],
  });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.corsOrigins });
  app.use(compression());
  app.useBodyParser('json', { limit: '1mb' });
  app.enableShutdownHooks();
  return app;
}

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await createApp(config);
  await app.listen(config.port, '0.0.0.0');
  new Logger('mystic-api').log(`listening on :${config.port}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  bootstrap().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
