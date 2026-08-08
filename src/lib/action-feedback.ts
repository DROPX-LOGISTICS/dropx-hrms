export type ActionFeedbackState = {
  ok: boolean;
  notice?: string;
  error?: string;
};

export const initialActionFeedback: ActionFeedbackState = { ok: true };

export function actionSuccess(notice: string): ActionFeedbackState {
  return { ok: true, notice, error: undefined };
}

export function actionError(error: string): ActionFeedbackState {
  return { ok: false, error, notice: undefined };
}

export type ActionHandler = (
  prevState: ActionFeedbackState,
  formData: FormData
) => Promise<ActionFeedbackState>;
