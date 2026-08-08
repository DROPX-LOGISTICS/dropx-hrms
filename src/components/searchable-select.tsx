"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const clearingForSearchRef = useRef(false);

  useEffect(() => {
    if (clearingForSearchRef.current) {
      clearingForSearchRef.current = false;
      return;
    }
    setQuery(selected?.label ?? "");
  }, [selected?.label]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(`#${CSS.escape(menuId)}`)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuId]);

  useEffect(() => {
    if (!open || !rootRef.current) {
      setMenuStyle(null);
      return;
    }
    const update = () => {
      const bounds = rootRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const spaceBelow = window.innerHeight - bounds.bottom - 12;
      const spaceAbove = bounds.top - 12;
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(240, Math.max(120, openUp ? spaceAbove - 8 : spaceBelow - 8));
      setMenuStyle({
        top: openUp ? bounds.top - maxHeight - 5 : bounds.bottom + 5,
        left: bounds.left,
        width: bounds.width,
        maxHeight
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

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

  const menu = open && !disabled && menuStyle ? createPortal(
    <div
      id={menuId}
      className="searchable-menu searchable-menu-portal"
      role="listbox"
      aria-label={`${placeholder} options`}
      style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width, maxHeight: menuStyle.maxHeight }}
    >
      {filtered.length ? filtered.map((option) => (
        <button
          className={`searchable-option${option.value === selectedValue ? " selected" : ""}`}
          type="button"
          role="option"
          aria-selected={option.value === selectedValue}
          key={option.value}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => choose(option.value)}
        >
          {option.label}
        </button>
      )) : <div className="searchable-empty">No matching options</div>}
    </div>,
    document.body
  ) : null;

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
            clearingForSearchRef.current = true;
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
      {selectedValue && !disabled ? (
        <button className="searchable-clear" type="button" aria-label={`Clear ${placeholder}`} onMouseDown={(event) => event.preventDefault()} onClick={() => choose("")}>
          <X size={15} />
        </button>
      ) : null}
      <button className="searchable-toggle" type="button" aria-label={`Show ${placeholder} options`} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen((current) => !current)}>
        <ChevronDown size={17} />
      </button>
    </div>
    {menu}
  </div>;
}
