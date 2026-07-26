import { SubmitButton } from "@/components/submit-button";

export function ProfileReviewPanel({
  action,
  accountId,
  label
}: {
  action: (formData: FormData) => void | Promise<void>;
  accountId: string;
  label: string;
}) {
  return <section className="profile-review-panel">
    <div className="profile-review-copy">
      <h3>Profile review</h3>
      <p>Approve this {label.toLowerCase()} profile or return it with clear correction remarks.</p>
    </div>
    <form action={action} className="profile-review-approve">
      <input name="account_id" type="hidden" value={accountId} />
      <input name="review_action" type="hidden" value="approve" />
      <SubmitButton className="button primary" pendingLabel="Approving…">Approve profile</SubmitButton>
    </form>
    <form action={action} className="profile-review-return">
      <input name="account_id" type="hidden" value={accountId} />
      <input name="review_action" type="hidden" value="return" />
      <label className="field">
        <span>Return remarks *</span>
        <textarea name="return_remarks" placeholder="Explain exactly what must be corrected" required rows={3} />
      </label>
      <SubmitButton className="button danger" pendingLabel="Returning…">Return profile</SubmitButton>
    </form>
  </section>;
}
