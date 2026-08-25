import { PAPER_UPLOAD_BUCKET } from './paper-upload';
import { getAdminClient } from '../supabase/admin';

const EXPIRY_GRACE_MS = 10 * 60 * 1000;
const DELETED_PAPER_GRACE_MS = 24 * 60 * 60 * 1000;
const FINALIZED_INTENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 100;

function batches<T>(values: T[]): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < values.length; start += CLEANUP_BATCH_SIZE) {
    result.push(values.slice(start, start + CLEANUP_BATCH_SIZE));
  }
  return result;
}

export interface UploadIntentCleanupResult {
  ok: boolean;
  scanned: number;
  repaired: number;
  removed: number;
}

interface ClaimedUploadIntent {
  intent_id: string;
  storage_path: string;
  action: 'repair' | 'delete';
}

async function cleanClaimedPaperUploadIntents(
  actorId: string | null,
  before: string,
  limit: number,
): Promise<UploadIntentCleanupResult> {
  const result: UploadIntentCleanupResult = {
    ok: true,
    scanned: 0,
    repaired: 0,
    removed: 0,
  };
  const admin = getAdminClient();
  const claimed = await admin.rpc('claim_archive_paper_upload_intents', {
    p_actor_id: actorId,
    p_before: before,
    p_limit: Math.max(1, Math.min(limit, 1000)),
  });
  if (claimed.error) throw new Error(claimed.error.message);

  const rows = (claimed.data ?? []) as ClaimedUploadIntent[];
  result.scanned = rows.length;
  result.repaired = rows.filter((row) => row.action === 'repair').length;
  const deletions = rows.filter((row) => row.action === 'delete');

  for (const batch of batches(deletions)) {
    const removed = await admin.storage
      .from(PAPER_UPLOAD_BUCKET)
      .remove(batch.map((intent) => intent.storage_path));
    if (removed.error) throw new Error(removed.error.message);

    const deleted = await admin
      .from('archive_paper_upload_intents')
      .delete()
      .eq('state', 'expired')
      .in(
        'id',
        batch.map((intent) => intent.intent_id),
      );
    if (deleted.error) throw new Error(deleted.error.message);
    result.removed += batch.length;
  }
  return result;
}

export async function cleanExpiredPaperUploadIntents(
  limit = 100,
): Promise<UploadIntentCleanupResult> {
  try {
    const cutoff = new Date(Date.now() - EXPIRY_GRACE_MS).toISOString();
    return await cleanClaimedPaperUploadIntents(null, cutoff, limit);
  } catch (error) {
    console.error('[archive-paper] expired-intent cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, scanned: 0, repaired: 0, removed: 0 };
  }
}

export async function cleanPaperUploadIntentsForActor(
  actorId: string,
  limit = 100,
): Promise<UploadIntentCleanupResult> {
  try {
    return await cleanClaimedPaperUploadIntents(
      actorId,
      new Date().toISOString(),
      limit,
    );
  } catch (error) {
    console.error('[archive-paper] actor-intent cleanup failed', {
      actorId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, scanned: 0, repaired: 0, removed: 0 };
  }
}

export interface ArchivePaperRetentionResult {
  ok: boolean;
  deletedPapers: number;
  deletedIntents: number;
}

export async function cleanArchivePaperRetention(
  limit = 100,
): Promise<ArchivePaperRetentionResult> {
  const result: ArchivePaperRetentionResult = {
    ok: true,
    deletedPapers: 0,
    deletedIntents: 0,
  };
  try {
    const admin = getAdminClient();
    const paperCutoff = new Date(
      Date.now() - DELETED_PAPER_GRACE_MS,
    ).toISOString();
    const papers = await admin
      .from('archive_papers')
      .select('id, storage_path')
      .lt('deleted_at', paperCutoff)
      .order('deleted_at', { ascending: true })
      .limit(Math.max(1, Math.min(limit, 1000)));
    if (papers.error) throw new Error(papers.error.message);

    for (const batch of batches(papers.data ?? [])) {
      const storage = await admin.storage
        .from(PAPER_UPLOAD_BUCKET)
        .remove(batch.map((paper) => paper.storage_path));
      if (storage.error) throw new Error(storage.error.message);
      const deleted = await admin
        .from('archive_papers')
        .delete()
        .in(
          'id',
          batch.map((paper) => paper.id),
        );
      if (deleted.error) throw new Error(deleted.error.message);
      result.deletedPapers += batch.length;
    }

    const intentCutoff = new Date(
      Date.now() - FINALIZED_INTENT_RETENTION_MS,
    ).toISOString();
    const staleIntents = await admin
      .from('archive_paper_upload_intents')
      .select('id')
      .eq('state', 'finalized')
      .lt('finalized_at', intentCutoff)
      .order('finalized_at', { ascending: true })
      .limit(Math.max(1, Math.min(limit, 1000)));
    if (staleIntents.error) throw new Error(staleIntents.error.message);
    if (staleIntents.data?.length) {
      const deleted = await admin
        .from('archive_paper_upload_intents')
        .delete()
        .in(
          'id',
          staleIntents.data.map((intent) => intent.id),
        );
      if (deleted.error) throw new Error(deleted.error.message);
      result.deletedIntents = staleIntents.data.length;
    }
    return result;
  } catch (error) {
    console.error('[archive-paper] retention cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ...result, ok: false };
  }
}
