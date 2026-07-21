"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

export type SearchableOption = { value: string; label: string };

type Props = {
  id?: string;
  name: string;
  options: SearchableOption[];
  placeholder: string;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  onChange?: (value: string) => void;
};

export function SearchableSelect({ id, name, options, placeholder, value, defaultValue = "", disabled, required, onChange }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const menuId = `${inputId}-options`;
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = controlled ? value : internalValue;
  const selected = options.find((option) => option.value === selectedValue);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(selected?.label ?? ""), [selected?.label]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || selected?.label === query) return options.slice(0, 30);
    return options.filter((option) => option.label.toLowerCase().includes(needle)).slice(0, 30);
  }, [options, query, selected?.label]);

  function choose(nextValue: string) {
    if (!controlled) setInternalValue(nextValue);
    onChange?.(nextValue);
    setQuery(options.find((option) => option.value === nextValue)?.label ?? "");
    setOpen(false);
  }

  return <div className={`searchable-select${disabled ? " disabled" : ""}`} ref={rootRef}>
    <input type="hidden" name={name} value={selectedValue ?? ""} />
    <div className="searchable-control">
      <input
        id={inputId}
        className="searchable-input"
        type="text"
        role="combobox"
        aria-controls={menuId}
        aria-autocomplete="list"
        aria-expanded={open}
        autoComplete="off"
        disabled={disabled}
        required={required && !selectedValue}
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          if (selectedValue) {
            if (!controlled) setInternalValue("");
            onChange?.("");
          }
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (!selectedValue) {
              const exact = options.find((option) => option.label.toLowerCase() === query.trim().toLowerCase());
              if (exact) choose(exact.value);
            }
          }, 100);
        }}
      />
      {selectedValue && !disabled ? <button className="searchable-clear" type="button" aria-label={`Clear ${placeholder}`} onClick={() => choose("")}><X size={15} /></button> : null}
      <button className="searchable-toggle" type="button" aria-label={`Show ${placeholder} options`} disabled={disabled} onClick={() => setOpen((current) => !current)}><ChevronDown size={17} /></button>
    </div>
    {open && !disabled ? <div id={menuId} className="searchable-menu" role="listbox" aria-label={`${placeholder} options`}>
      {filtered.length ? filtered.map((option) => <button className={`searchable-option${option.value === selectedValue ? " selected" : ""}`} type="button" role="option" aria-selected={option.value === selectedValue} key={option.value} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option.value)}>{option.label}</button>) : <div className="searchable-empty">No matching options</div>}
    </div> : null}
  </div>;
}
