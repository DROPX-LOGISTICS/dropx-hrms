import type { ActionFeedbackState } from "@/lib/action-feedback";

export function FormFeedback({ state }: { state: ActionFeedbackState }) {
  if (state.error) return <div className="alert error" role="alert">{state.error}</div>;
  if (state.notice) return <div className="alert success" role="status">{state.notice}</div>;
  return null;
}
