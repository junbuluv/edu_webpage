import { hmacPIIHex } from './crypto/pii';
import { getAdminClient } from './supabase/admin';
import type { Json } from './supabase/database.types';

export type DisclosureAction =
  | 'read_student_profile'
  | 'read_student_attempts'
  | 'read_class_roster'
  | 'export_student_data'
  | 'delete_user'
  | 'promote_role';

export interface DisclosureContext {
  actorId: string;
  actorRole: 'instructor' | 'ta' | 'admin';
  action: DisclosureAction;
  targetUserId?: string;
  targetResource?: string;
  metadata?: Json;
  request?: Request;
}

function clientIp(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? null;
  return request.headers.get('x-real-ip') ?? null;
}

export async function logDisclosure(ctx: DisclosureContext): Promise<void> {
  const admin = getAdminClient();
  const ip = ctx.request ? clientIp(ctx.request) : null;
  const ua = ctx.request?.headers.get('user-agent') ?? null;

  const { error } = await admin.from('audit_log').insert({
    actor_id: ctx.actorId,
    actor_role: ctx.actorRole,
    action: ctx.action,
    target_user_id: ctx.targetUserId ?? null,
    target_resource: ctx.targetResource ?? null,
    client_ip_hmac: ip ? hmacPIIHex(ip) : null,
    user_agent_hmac: ua ? hmacPIIHex(ua) : null,
    metadata: ctx.metadata ?? null,
  });

  if (error) {
    console.error('[audit] failed to record disclosure', {
      action: ctx.action,
      error: error.message,
    });
    throw new Error('audit write failed');
  }
}
