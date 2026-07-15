import type { APIRoute } from 'astro';
import { canViewCourse } from '@lib/archive/access';
import {
  fetchArchivePaperById,
  signPaperUrl,
} from '@lib/archive/db';
import { ArchiveServiceUnavailableError } from '@lib/archive/errors';
import { isUuid } from '@lib/workshop-policy';

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return text('Authentication required.', 401);
  const id = params.id;
  if (!id || !isUuid(id)) return text('Not found.', 404);

  try {
    const paper = await fetchArchivePaperById(id);
    if (!paper) return text('Not found.', 404);
    if (!(await canViewCourse(locals, paper.course_slug))) {
      return text('Not found.', 404);
    }
    const signedUrl = await signPaperUrl(
      paper.storage_path,
      paper.original_filename,
    );
    return new Response(null, {
      status: 302,
      headers: {
        location: signedUrl,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof ArchiveServiceUnavailableError) {
      return text('Archive files are temporarily unavailable. Retry shortly.', 503);
    }
    throw error;
  }
};

function text(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'private, no-store',
    },
  });
}
