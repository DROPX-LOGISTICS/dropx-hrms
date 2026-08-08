import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { SearchableSelect } from "@/components/searchable-select";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { listLeaveTypes, loadCompanySettings } from "@/lib/data";
import { addLeaveType, saveLeavePolicy, toggleLeaveType } from "./actions";

export const metadata: Metadata = { title: "Leave policy" };

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2026, index, 1))
}));

export default async function LeavePolicyPage() {
  const auth = await requireHrmsAuth("settings.manage");
  const [settings, leaveTypes] = await Promise.all([loadCompanySettings(auth), listLeaveTypes(auth, true)]);
  return <>
    <PageHeader eyebrow="Settings" title="Leave policy" description="Configure the leave year and the leave types available to employees." action={<Link className="button secondary" href="/settings">Settings</Link>} />

    <section className="grid two-column">
      <article className="panel">
        <div className="panel-head"><h2>Leave year</h2></div>
        <div className="panel-body"><ActionForm action={saveLeavePolicy}>
          <div className="field"><label htmlFor="leave-year-start">Leave year starts *</label><SearchableSelect id="leave-year-start" name="leave_year_start_month" options={monthOptions} defaultValue={String(settings?.leave_year_start_month ?? 1)} placeholder="Search month" required /></div>
          <div className="form-actions"><SubmitButton className="button primary" pendingLabel="Saving leave policy…">Save leave policy</SubmitButton></div>
        </ActionForm></div>
      </article>
      <article className="panel">
        <div className="panel-head"><h2>Add leave type</h2></div>
        <div className="panel-body"><ActionForm action={addLeaveType}><div className="grid">
          <div className="field"><label htmlFor="leave-type-name">Name</label><input id="leave-type-name" name="name" required /></div>
          <div className="field"><label htmlFor="leave-type-code">Code</label><input id="leave-type-code" name="code" placeholder="CASUAL" required /></div>
          <div className="field"><label htmlFor="annual-allowance">Annual allowance</label><input id="annual-allowance" name="annual_allowance" type="number" min="0" max="365" required /></div>
          <div className="field"><label htmlFor="leave-colour">Colour</label><input id="leave-colour" name="color" type="color" defaultValue="#1f7a50" /></div>
          <SubmitButton className="button primary" pendingLabel="Creating leave type…">Create leave type</SubmitButton>
        </div></ActionForm></div>
      </article>
    </section>

    <section className="panel" style={{ marginTop: 18 }}>
      <div className="panel-head"><h2>Leave types</h2></div>
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Code</th><th>Annual allowance</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {leaveTypes.length ? leaveTypes.map((type) => <tr key={type.id}><td><strong>{type.name}</strong></td><td>{type.code}</td><td>{type.annual_allowance} days</td><td><StatusPill value={type.is_active ? "active" : "inactive"} /></td><td><ActionForm action={toggleLeaveType}><input type="hidden" name="leave_type_id" value={type.id} /><input type="hidden" name="next_active" value={type.is_active ? "false" : "true"} /><SubmitButton className="button secondary small" pendingLabel={type.is_active ? "Deactivating…" : "Activating…"}>{type.is_active ? "Deactivate" : "Activate"}</SubmitButton></ActionForm></td></tr>) : <tr><td className="empty-cell" colSpan={5}>No leave types configured.</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
