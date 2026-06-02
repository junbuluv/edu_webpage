import { useMemo, useState } from 'react';
import { filterItems, semesterLabel } from '@lib/archive/build';
import type { ArchiveItem, ArchiveItemType, Facets } from '@lib/archive/types';

const TYPE_LABEL: Record<ArchiveItemType, string> = {
  notes: 'Lecture notes',
  exam: 'Exams',
  assignment: 'Assignments',
  video: 'Videos',
};

function embedSrc(item: ArchiveItem): string {
  if (item.provider === 'youtube')
    return `https://www.youtube-nocookie.com/embed/${item.videoId}`;
  return `https://player.vimeo.com/video/${item.videoId}`;
}

interface Props {
  items: ArchiveItem[];
  facets: Facets;
}

export default function ArchiveBrowser({ items, facets }: Props) {
  const [type, setType] = useState<string | null>(null);
  const [semester, setSemester] = useState<string | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [lesson, setLesson] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [openVideo, setOpenVideo] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterItems(items, { type, semester, unit, lesson, query }),
    [items, type, semester, unit, lesson, query],
  );

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${
      active
        ? 'border-accent bg-accent/10 font-medium text-accent'
        : 'border-slate-300 text-ink-muted hover:bg-slate-50'
    }`;

  return (
    <div className="mt-6">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
        placeholder="Search the archive…"
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        aria-label="Search the archive"
      />

      {/* Type facet */}
      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by type"
      >
        <button
          type="button"
          className={pill(type === null)}
          onClick={() => setType(null)}
        >
          All types
        </button>
        {facets.types.map((t) => (
          <button
            key={t}
            type="button"
            className={pill(type === t)}
            onClick={() => setType(t)}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Dropdown facets */}
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {facets.semesters.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="text-ink-muted">Semester</span>
            <select
              className="rounded border border-slate-300 px-2 py-1"
              value={semester ?? ''}
              onChange={(e) =>
                setSemester((e.target as HTMLSelectElement).value || null)
              }
            >
              <option value="">All</option>
              {facets.semesters.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {facets.units.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="text-ink-muted">Unit</span>
            <select
              className="rounded border border-slate-300 px-2 py-1"
              value={unit ?? ''}
              onChange={(e) =>
                setUnit((e.target as HTMLSelectElement).value || null)
              }
            >
              <option value="">All</option>
              {facets.units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        )}
        {facets.lessons.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="text-ink-muted">Lesson</span>
            <select
              className="rounded border border-slate-300 px-2 py-1"
              value={lesson ?? ''}
              onChange={(e) =>
                setLesson((e.target as HTMLSelectElement).value || null)
              }
            >
              <option value="">All</option>
              {facets.lessons.map((l) => (
                <option key={l.slug} value={l.slug}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {semester && (
        <p className="mt-2 text-xs text-ink-muted">
          Lecture notes are not semester-specific and are hidden while a
          semester filter is active.
        </p>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
      </p>

      <ul className="mt-2 space-y-3">
        {filtered.map((item) => (
          <li
            key={item.id}
            className="rounded border border-slate-200 p-4 hover:border-accent"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs uppercase tracking-wide text-ink-muted">
                {TYPE_LABEL[item.type]}
              </span>
              {item.semester && (
                <span className="text-xs text-ink-muted">
                  {semesterLabel(item.semester)}
                </span>
              )}
            </div>

            {item.type === 'video' ? (
              <>
                <button
                  type="button"
                  className="mt-1 text-left font-medium text-accent underline"
                  onClick={() =>
                    setOpenVideo(openVideo === item.id ? null : item.id)
                  }
                  aria-expanded={openVideo === item.id}
                  aria-label={`${openVideo === item.id ? 'Hide' : 'Play'} video: ${item.title}`}
                >
                  {item.title}
                </button>
                {openVideo === item.id && (
                  <div className="mt-3 aspect-video w-full">
                    <iframe
                      className="h-full w-full rounded"
                      src={embedSrc(item)}
                      title={item.title}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
              </>
            ) : item.fileUrl ? (
              <a
                href={item.fileUrl}
                target="_blank"
                rel="noopener"
                className="mt-1 block font-medium text-accent hover:underline"
              >
                {item.title}{' '}
                <span className="text-xs text-ink-muted">
                  (download{item.fileName ? ` · ${item.fileName}` : ''})
                </span>
              </a>
            ) : (
              <a
                href={item.href}
                className="mt-1 block font-medium hover:text-accent"
              >
                {item.title}
              </a>
            )}
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="mt-6 text-ink-muted">No matching materials yet.</p>
      )}
    </div>
  );
}
