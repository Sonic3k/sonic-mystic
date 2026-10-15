/* Who may call what. 'public': anyone (the book, tra cứu, setting up a chart) — but the text of a source marked for
   the owner (a published book, under copyright) is answered only to isOwner. 'owner': the family's own data —
   open while ADMIN_TOKEN is not set (as Sonic Hub is for now), closed to anyone without it once it is.
   'sync': Sonic Hub only, signed with SYNC_TOKEN (closed when no token is configured). */
import { BadRequestException, type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable, type PipeTransform, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { z } from 'zod';
import type { AppConfig } from '../config.js';
import { APP_CONFIG } from './tokens.js';

export type AccessLevel = 'public' | 'owner' | 'sync';
const ACCESS = 'mystic:access';
export const Access = (level: AccessLevel) => SetMetadata(ACCESS, level);

const headerOf = (req: Request, n: string) => { const v = req.headers[n]; return Array.isArray(v) ? v[0] : v; };

/** whether a request comes from the owner (always, while ADMIN_TOKEN is not set) — for public routes whose answer
    depends on it, such as a book whose text only the owner may read */
export function isOwner(config: AppConfig, req: Request): boolean {
  if (!config.adminToken) return true;
  const token = headerOf(req, 'x-admin-token') ?? headerOf(req, 'authorization')?.replace(/^Bearer\s+/i, '');
  return token === config.adminToken || (!!config.syncToken && headerOf(req, 'x-sync-token') === config.syncToken);
}

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector, @Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(ctx: ExecutionContext): boolean {
    const level = this.reflector.getAllAndOverride<AccessLevel>(ACCESS, [ctx.getHandler(), ctx.getClass()]) ?? 'owner';
    if (level === 'public') return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    if (level === 'sync') {
      if (!this.config.syncToken) throw new ForbiddenException('SYNC_TOKEN chưa được cấu hình');
      if (headerOf(req, 'x-sync-token') === this.config.syncToken) return true;
      throw new UnauthorizedException('Sai mã đồng bộ');
    }
    if (isOwner(this.config, req)) return true;
    throw new UnauthorizedException('Cần mã chủ nhà');
  }
}

/** validates a request body against a Zod schema */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const r = this.schema.safeParse(value);
    if (r.success) return r.data;
    throw new BadRequestException(r.error.issues.map(i => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '));
  }
}
