"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SubmitButton } from "@/components/submit-button";

type ConfirmSubmitButtonProps = {
  children: ReactNode;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  className?: string;
  confirmClassName?: string;
  pendingLabel?: string;
  disabled?: boolean;
};

/** Submit button for a server-action form that asks for confirmation in a styled dialog before the form is submitted. */
export function ConfirmSubmitButton({
  cancelLabel = "Go back",
  children,
  className = "button primary",
  confirmClassName = "button primary",
  confirmLabel,
  disabled,
  message,
  pendingLabel,
  title
}: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function submitConfirmed() {
    const form = buttonRef.current?.form;
    setOpen(false);
    // requestSubmit keeps this button as the submitter (so its name/value still reach the action)
    // without re-triggering the click handler that opened the dialog.
    queueMicrotask(() => form?.requestSubmit(buttonRef.current));
  }

  return <>
    <SubmitButton
      ref={buttonRef}
      className={className}
      disabled={disabled}
      pendingLabel={pendingLabel}
      onClick={(event) => {
        event.preventDefault();
        setOpen(true);
      }}
    >{children}</SubmitButton>
    {open ? createPortal(
      <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}>
        <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <h3 id={titleId}>{title}</h3>
          <p>{message}</p>
          <div className="form-actions">
            <button className="button secondary" type="button" onClick={() => setOpen(false)}>{cancelLabel}</button>
            <button ref={confirmRef} className={confirmClassName} type="button" onClick={submitConfirmed}>{confirmLabel}</button>
          </div>
        </div>
      </div>,
      document.body
    ) : null}
  </>;
}
