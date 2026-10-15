import { Inject, Injectable, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type pg from 'pg';
import { AiService } from './ai/ai.service.js';
import { BooksService } from './books/books.service.js';
import { AccessGuard } from './common/access.js';
import { APP_CONFIG } from './common/tokens.js';
import type { AppConfig } from './config.js';
import { createDb, DB, PG_POOL } from './db/db.js';
import { BooksController, HealthController, MetaController, PeopleController, TuViController } from './http/controllers.js';
import { KnowledgeService } from './kb/knowledge.service.js';
import { PeopleService } from './people/people.service.js';
import { SonicHubClient } from './sync/sonic-hub.client.js';
import { SyncService } from './sync/sync.service.js';
import { TuViService } from './tuvi/tuvi.service.js';

@Injectable()
export class PoolLifecycle implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> { await this.pool.end(); }
}

@Module({})
export class AppModule {
  static forRoot(config: AppConfig, pool: pg.Pool): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, MetaController, BooksController, TuViController, PeopleController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: PG_POOL, useValue: pool },
        { provide: DB, useValue: createDb(pool) },
        { provide: APP_GUARD, useClass: AccessGuard },
        PoolLifecycle,
        KnowledgeService,
        TuViService,
        BooksService,
        SonicHubClient,
        SyncService,
        PeopleService,
        AiService,
      ],
    };
  }
}
