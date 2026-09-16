import { useEffect, useRef, useState } from "react";

export interface MultiSelectOption {
  id: string;
  name: string;
  description?: string;
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = "Choose…",
}: {
  label: string;
  options: readonly MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }

  const summary = selected.length
    ? options
        .filter((option) => selected.includes(option.id))
        .map((option) => option.name)
        .join(", ")
    : placeholder;

  return (
    <div className={`multi-select${open ? " open" : ""}`} ref={root}>
      <button
        type="button"
        className="multi-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="multi-select-value">{summary}</span>
        <span aria-hidden="true" className="multi-select-caret">▾</span>
      </button>
      {open && (
        <div className="multi-select-panel" role="group" aria-label={label}>
          {options.map((option) => (
            <label className="multi-select-option" key={option.id}>
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={() => toggle(option.id)}
              />
              <span>
                <strong>{option.name}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
