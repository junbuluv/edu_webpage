import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { getCollection } from 'astro:content';
import type { QuestionT } from '@/content/config';

type Answers = Record<string, number | number[] | string>;

interface Body {
  adminId?: string;
  attemptId?: string;
  answers?: Answers;
  lat?: number;
  lng?: number;
}

// Grace window for clock skew and submit-in-flight latency.
const GRACE_MS = 30_000;

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return resp({ ok: false, reason: 'not signed in' }, 401);

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.adminId || !body.attemptId) {
    return resp({ ok: false, reason: 'missing adminId or attemptId' }, 400);
  }

  const admin = getAdminClient();

  // Verify the attempt belongs to this user and isn't already submitted.
  const { data: attempt } = await admin
    .from('exam_attempts')
    .select('id, user_id, administration_id, started_at, submitted_at')
    .eq('id', body.attemptId)
    .maybeSingle();
  if (!attempt || attempt.user_id !== user.id) {
    return resp({ ok: false, reason: 'attempt not found' }, 404);
  }
  if (attempt.administration_id !== body.adminId) {
    return resp({ ok: false, reason: 'attempt does not match administration' }, 400);
  }
  if (attempt.submitted_at) {
    return resp({ ok: false, reason: 'already submitted' });
  }

  // Fetch administration for time + duration checks.
  const { data: row } = await admin
    .from('exam_administrations')
    .select('exam_slug, opens_at, closes_at, duration_minutes')
    .eq('id', body.adminId)
    .maybeSingle();
  if (!row) return resp({ ok: false, reason: 'administration not found' }, 404);

  const now = Date.now();
  const closes = Date.parse(row.closes_at);
  const deadline = Math.min(
    closes,
    Date.parse(attempt.started_at) + row.duration_minutes * 60_000,
  );
  // Hard-reject past the per-attempt deadline, regardless of whether the
  // administration window is still open. The duration cap is the contract;
  // a student who started early shouldn't get the full window.
  if (now > deadline + GRACE_MS) {
    return resp({
      ok: false,
      reason: 'submission rejected: past per-attempt deadline',
    });
  }
  if (now > closes + GRACE_MS) {
    return resp({ ok: false, reason: 'window closed; submission rejected' });
  }

  // Load static exam to grade.
  const exams = await getCollection('exams');
  const examEntry = exams.find((e) => e.data.slug === row.exam_slug);
  if (!examEntry) return resp({ ok: false, reason: 'exam content missing' }, 500);
  const exam = examEntry.data;

  const answers = body.answers ?? {};
  const { score, maxScore } = grade(exam.questions, answers);

  // Atomic update: only update if submitted_at is still null. Prevents
  // two concurrent submit calls from overwriting each other.
  const { data: updated, error } = await admin
    .from('exam_attempts')
    .update({
      submitted_at: new Date().toISOString(),
      client_lat_submit: body.lat ?? null,
      client_lng_submit: body.lng ?? null,
      score,
      max_score: maxScore,
      answers: answers as never,
    })
    .eq('id', body.attemptId)
    .is('submitted_at', null)
    .select('id');

  if (error) return resp({ ok: false, reason: error.message }, 500);
  if (!updated || updated.length === 0) {
    return resp({ ok: false, reason: 'already submitted (race)' });
  }

  return resp({ ok: true, score, maxScore });
};

function grade(
  questions: QuestionT[],
  answers: Answers,
): { score: number; maxScore: number } {
  let score = 0;
  let maxScore = 0;
  for (const q of questions) {
    maxScore += q.points;
    const a = answers[q.id];
    let correct = false;
    if (q.type === 'multiple_choice' && typeof a === 'number') {
      correct = a === q.correctIndex;
    } else if (q.type === 'multi_select' && Array.isArray(a)) {
      const sub = [...a].sort().join(',');
      const expected = [...q.correctIndices].sort().join(',');
      correct = sub === expected;
    } else if (q.type === 'numeric' && typeof a === 'string') {
      const parsed = Number(a);
      if (Number.isFinite(parsed)) {
        correct = Math.abs(parsed - q.answer) <= q.tolerance;
      }
    }
    if (correct) score += q.points;
  }
  return { score, maxScore };
}

function resp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
