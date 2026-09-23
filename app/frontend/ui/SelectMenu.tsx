import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

export type SelectMenuOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export function SelectMenu({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled = false,
  hideLabel = false,
  searchable = false,
}: {
  label: string;
  value: string;
  options: SelectMenuOption[];
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hideLabel?: boolean;
  searchable?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);
  const visibleOptions = searchable
    ? options.filter((option) =>
        `${option.label} ${option.description ?? ''}`.toLowerCase().includes(query.toLowerCase()),
      )
    : options;
  const firstEnabled = visibleOptions.findIndex((option) => !option.disabled);
  const [activeIndex, setActiveIndex] = useState(
    Math.max(
      visibleOptions.findIndex((option) => option.value === value && !option.disabled),
      firstEnabled,
    ),
  );

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (searchable) searchRef.current?.focus();
    else if (activeIndex >= 0) optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open, searchable]);

  const move = (direction: 1 | -1) => {
    if (visibleOptions.length === 0) return;
    let next = activeIndex;
    for (let count = 0; count < visibleOptions.length; count += 1) {
      next = (next + direction + visibleOptions.length) % visibleOptions.length;
      if (!visibleOptions[next]?.disabled) {
        setActiveIndex(next);
        return;
      }
    }
  };

  const choose = (option: SelectMenuOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    queueMicrotask(() => trigger.current?.focus());
  };

  return (
    <div className="select-field" ref={root}>
      <span id={`${id}-label`} className={hideLabel ? 'sr-only' : 'field-label'}>
        {label}
      </span>
      <button
        type="button"
        className="select-trigger"
        ref={trigger}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        disabled={disabled}
        onClick={() => {
          setQuery('');
          setActiveIndex(
            Math.max(
              visibleOptions.findIndex((option) => option.value === value && !option.disabled),
              firstEnabled,
            ),
          );
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            if (open) move(event.key === 'ArrowDown' ? 1 : -1);
          }
        }}
      >
        <span id={`${id}-value`} className={selected ? undefined : 'placeholder'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="select-popover">
          {searchable && (
            <input
              ref={searchRef}
              className="select-search"
              type="search"
              value={query}
              placeholder="Type to filter"
              aria-label={`Search ${label}`}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setOpen(false);
                  queueMicrotask(() => trigger.current?.focus());
                }
              }}
            />
          )}
          <div
            id={`${id}-listbox`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
                queueMicrotask(() => trigger.current?.focus());
              } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                move(event.key === 'ArrowDown' ? 1 : -1);
              } else if (event.key === 'Home') {
                event.preventDefault();
                setActiveIndex(firstEnabled);
              } else if (event.key === 'End') {
                event.preventDefault();
                const last = [...visibleOptions].map(({ disabled }) => disabled).lastIndexOf(false);
                setActiveIndex(last);
              } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                const option = visibleOptions[activeIndex];
                if (option) choose(option);
              }
            }}
          >
            {visibleOptions.length === 0 ? (
              <p className="select-empty">No options available</p>
            ) : (
              visibleOptions.map((option, index) => (
                <button
                  type="button"
                  role="option"
                  aria-label={
                    option.description ? `${option.label}, ${option.description}` : option.label
                  }
                  aria-selected={option.value === value}
                  disabled={option.disabled}
                  key={option.value}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  onClick={() => choose(option)}
                >
                  <span>
                    <strong>{option.label}</strong>
                    {option.description && <small>{option.description}</small>}
                  </span>
                  {option.value === value && <Check size={16} aria-hidden="true" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
