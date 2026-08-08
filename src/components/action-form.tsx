"use client";

import { useFormState } from "react-dom";
import { FormFeedback } from "@/components/form-feedback";
import { initialActionFeedback, type ActionHandler } from "@/lib/action-feedback";

export function ActionForm({
  action,
  children,
  className
}: {
  action: ActionHandler;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useFormState(action, initialActionFeedback);
  return (
    <form action={formAction} className={className}>
      <FormFeedback state={state} />
      {children}
    </form>
  );
}
