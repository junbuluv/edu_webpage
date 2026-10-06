// Server-only lesson-tutor usage: reserve a message against the daily cap
// (service role, consume_tutor_quota), record token counts after the stream,
// and count messages left for the panel (the student's own RLS read). No
// message text is ever stored or logged.
import { getAdminClient } from '@lib/supabase/admin';
import type { SupabaseServerClient } from '@lib/supabase/server';
import { TUTOR_DAILY_LIMIT } from './limits';

export type QuotaResult =
  | { status: 'ok'; messageId: string; remaining: number }
  | { status: 'rate_limited' }
  | { status: 'error' };

export interface TutorUsage {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function consumeTutorQuota(
  userId: string,
  courseSlug: string,
  lessonSlug: string,
): Promise<QuotaResult> {
  try {
    const { data, error } = await getAdminClient().rpc('consume_tutor_quota', {
      p_user_id: userId,
      p_course_slug: courseSlug,
      p_lesson_slug: lessonSlug,
      p_daily_limit: TUTOR_DAILY_LIMIT,
    });
    if (error) {
      console.error('[tutor] quota_failed', { code: error.code });
      return { status: 'error' };
    }
    const row = data?.[0];
    if (row?.status === 'ok' && row.message_id) {
      return {
        status: 'ok',
        messageId: row.message_id,
        remaining: row.remaining,
      };
    }
    if (row?.status === 'rate_limited') return { status: 'rate_limited' };
    console.error('[tutor] quota_unexpected', { status: row?.status ?? null });
    return { status: 'error' };
  } catch (error) {
    console.error('[tutor] quota_failed', { error: errorMessage(error) });
    return { status: 'error' };
  }
}

export async function recordTutorUsage(
  messageId: string,
  modelId: string,
  usage: TutorUsage,
): Promise<void> {
  try {
    const { error } = await getAdminClient()
      .from('tutor_messages')
      .update({
        model: modelId,
        input_tokens: usage.inputTokens ?? null,
        output_tokens: usage.outputTokens ?? null,
        reasoning_tokens: usage.reasoningTokens ?? null,
      })
      .eq('id', messageId);
    if (error)
      console.error('[tutor] usage_record_failed', { code: error.code });
  } catch (error) {
    console.error('[tutor] usage_record_failed', {
      error: errorMessage(error),
    });
  }
}

/** Messages left in the rolling 24-hour window. Display only; the RPC enforces. */
export async function tutorMessagesRemaining(
  supabase: NonNullable<SupabaseServerClient>,
  userId: string,
): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('tutor_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);
  if (error) {
    console.error('[tutor] remaining_read_failed', { code: error.code });
    return TUTOR_DAILY_LIMIT;
  }
  return Math.max(0, TUTOR_DAILY_LIMIT - (count ?? 0));
}
