'use client';

import { useState } from 'react';

export function Composer({
  onSend,
  disabled,
}: {
  onSend: (message: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  return (
    <form
      className="flex gap-2 border-t border-[var(--color-border)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onSend(value.trim());
        setValue('');
      }}
    >
      <label htmlFor="composer" className="sr-only">
        Message
      </label>
      <input
        id="composer"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder="Ask about the portfolio…"
        className="flex-1 rounded border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}
