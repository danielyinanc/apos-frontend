'use client';

export function ModelCommentary({
  text,
  packId,
  version,
}: {
  text: string;
  packId: string;
  version: string;
}) {
  return (
    <blockquote
      cite={`${packId}@${version}`}
      className="border-l-4 border-[var(--color-accent)] bg-[var(--color-panel)] p-3 text-sm italic"
    >
      <p className="mb-1 text-xs font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase not-italic">
        Model commentary
      </p>
      <p>{text}</p>
      <footer className="mt-1 text-xs text-[var(--color-fg-muted)] not-italic">
        Generated text. Not a compliance determination. Source: {packId}@{version}
      </footer>
    </blockquote>
  );
}
