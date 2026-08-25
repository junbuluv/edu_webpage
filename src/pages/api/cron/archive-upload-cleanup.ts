import type { APIRoute } from 'astro';
import {
  cleanArchivePaperRetention,
  cleanExpiredPaperUploadIntents,
} from '@lib/archive/upload-intent-cleanup';

export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.CRON_SECRET;
  if (
    !secret ||
    secret.length < 16 ||
    request.headers.get('authorization') !== `Bearer ${secret}`
  ) {
    return json({ ok: false }, 401);
  }

  const [expiredUploads, retention] = await Promise.all([
    cleanExpiredPaperUploadIntents(500),
    cleanArchivePaperRetention(500),
  ]);
  const ok = expiredUploads.ok && retention.ok;
  return json({ ok, expiredUploads, retention }, ok ? 200 : 500);
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
