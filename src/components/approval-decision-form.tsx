"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { reviewLeave } from "@/app/(hrms)/approvals/actions";

export function ApprovalDecisionForm({ requestId, employeeName }: { requestId: string; employeeName: string }) {
  return (
    <ActionForm action={reviewLeave}>
      <input type="hidden" name="request_id" value={requestId} />
      <div className="inline-actions">
        <input aria-label={`Reviewer note for ${employeeName}`} name="reviewer_note" placeholder="Reviewer note" />
        <SubmitButton className="button primary small" name="decision" pendingLabel="Approving…" value="approved">Approve</SubmitButton>
        <SubmitButton className="button danger small" name="decision" pendingLabel="Rejecting…" value="rejected">Reject</SubmitButton>
      </div>
    </ActionForm>
  );
}
