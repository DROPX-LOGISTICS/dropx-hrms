"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  children: ReactNode;
  pendingLabel?: string;
};

export function isCurrentFormAction(data: FormData | null, name?: string, value?: ButtonHTMLAttributes<HTMLButtonElement>["value"]) {
  if (!name) return true;
  return String(data?.get(name) ?? "") === String(value ?? "");
}

export const SubmitButton = forwardRef<HTMLButtonElement, SubmitButtonProps>(function SubmitButton(
  { children, disabled, name, pendingLabel = "Working…", value, ...props },
  ref
) {
  const { data, pending } = useFormStatus();
  const showPending = pending && isCurrentFormAction(data, name, value);

  return (
    <button {...props} ref={ref} aria-busy={showPending || undefined} disabled={disabled || pending} name={name} type="submit" value={value}>
      {showPending ? <><span aria-hidden="true" className="loading-spinner" />{pendingLabel}</> : children}
    </button>
  );
});
