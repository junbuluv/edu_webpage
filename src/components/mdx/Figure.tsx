interface Props {
  src: string;
  alt: string;
  caption?: string;
  credit?: string;
  creditHref?: string;
  maxWidth?: 'max-w-xl' | 'max-w-2xl' | 'max-w-3xl';
}

export default function Figure({
  src,
  alt,
  caption,
  credit,
  creditHref,
  maxWidth = 'max-w-2xl',
}: Props) {
  return (
    <figure className={`mx-auto my-8 ${maxWidth}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full rounded border border-slate-200"
      />
      {(caption || credit) && (
        <figcaption className="mt-2 text-xs text-ink-muted">
          {caption && <span className="block">{caption}</span>}
          {credit && (
            <span className="mt-1 block italic">
              Source:{' '}
              {creditHref ? (
                <a href={creditHref} className="underline" rel="noopener" target="_blank">
                  {credit}
                </a>
              ) : (
                credit
              )}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
