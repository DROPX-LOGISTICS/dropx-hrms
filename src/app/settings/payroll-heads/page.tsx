import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PayrollHeadActionsMenu } from "@/components/payroll-head-actions-menu";
import { SearchableSelect } from "@/components/searchable-select";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { loadPayrollSettings, PayrollHeadRow } from "@/lib/payroll";
import { createPayrollHead, savePayrollHead, togglePayrollHead } from "./actions";

export const metadata: Metadata = { title: "Payroll heads" };
export const dynamic = "force-dynamic";

const payTypeOptions = [
  { value: "employee_earning", label: "Employee Earning" },
  { value: "employee_deduction", label: "Employee Deduction" },
  { value: "statutory_deduction", label: "Statutory Deduction" },
  { value: "statutory_contribution", label: "Statutory Contribution" }
];
const typeLabel: Record<PayrollHeadRow["head_type"], string> = {
  ctc: "System CTC",
  employee_earning: "Employee Earning",
  employee_deduction: "Employee Deduction",
  statutory_deduction: "Statutory Deduction",
  statutory_contribution: "Statutory Contribution"
};

export default async function PayrollHeadsPage({
  searchParams
}: {
  searchParams?: { error?: string; notice?: string; head?: string; mode?: string };
}) {
  const auth = await requireHrmsAuth("settings.manage");
  const { heads } = await loadPayrollSettings(auth);
  const customHeads = heads.filter((head) => !head.is_system);
  const selectedHead = heads.find((head) => head.id === searchParams?.head) ?? null;
  const selectedMode = searchParams?.mode === "edit" && selectedHead && !selectedHead.is_system ? "edit" : "view";

  return <AppShell auth={auth} active="Payroll Heads">
    <PageHeader
      eyebrow="Settings"
      title="Payroll heads"
      description="Create the reusable earning, deduction and statutory components used in salary configurations."
      action={<Link className="button secondary" href="/settings">Settings</Link>}
    />
    {searchParams?.error ? <div className="alert error">{searchParams.error}</div> : null}
    {searchParams?.notice ? <div className="alert success">{searchParams.notice}</div> : null}

    <section className="grid stats-grid">
      <article className="card stat"><span className="stat-label">Total heads</span><strong className="stat-value">{heads.length}</strong><span className="stat-meta">Including protected CTC</span></article>
      <article className="card stat"><span className="stat-label">Active custom heads</span><strong className="stat-value">{customHeads.filter((head) => head.is_active).length}</strong><span className="stat-meta">Available for configurations</span></article>
      <article className="card stat"><span className="stat-label">Pay types</span><strong className="stat-value">4</strong><span className="stat-meta">Earnings, deductions and statutory</span></article>
      <article className="card stat"><span className="stat-label">Protected head</span><strong className="stat-value text-value">CTC</strong><span className="stat-meta">Cost to the company</span></article>
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Add payroll head</h2><p className="panel-subtitle">Code is permanent and can be used inside salary equations.</p></div></div>
      <div className="panel-body payroll-head-create-body">
        <form action={createPayrollHead}>
          <div className="master-entry-grid payroll-head-create">
            <div className="field"><label htmlFor="payroll-head-name">Name *</label><input id="payroll-head-name" name="name" placeholder="Basic Salary" required /></div>
            <div className="field"><label htmlFor="payroll-head-code">Code *</label><input id="payroll-head-code" name="code" placeholder="BASIC_SALARY" required /><small>Letters, numbers and underscores only.</small></div>
            <div className="field"><label htmlFor="payroll-head-type">Pay type *</label><SearchableSelect id="payroll-head-type" name="head_type" options={payTypeOptions} placeholder="Search pay type" required /></div>
            <SubmitButton className="button primary" pendingLabel="Creating payroll head…">Create payroll head</SubmitButton>
          </div>
        </form>
      </div>
    </section>

    <section className="panel payroll-head-master" style={{ marginTop: 18 }}>
      <div className="panel-head"><div><h2>Payroll head master</h2><p className="panel-subtitle">View and maintain every system and custom payroll head from one master.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Code</th><th>Pay type</th><th>Source</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {heads.map((head) => <tr key={head.id}>
          <td><strong>{head.name}</strong></td>
          <td><code>{head.code}</code></td>
          <td>{typeLabel[head.head_type]}</td>
          <td>{head.is_system ? <span className="system-badge">System</span> : "Custom"}</td>
          <td><StatusPill value={head.is_active ? "active" : "inactive"} /></td>
          <td><PayrollHeadActionsMenu payrollHeadId={head.id} payrollHeadName={head.name} canEdit={!head.is_system} /></td>
        </tr>)}
      </tbody></table></div>

      {selectedHead ? <div className="panel-body payroll-head-details" id="payroll-head-details">
        <div className="payroll-head-detail-heading">
          <div><span className="eyebrow">{selectedMode === "edit" ? "Edit payroll head" : "Payroll head details"}</span><h3>{selectedHead.name}</h3><p>{selectedHead.code} · {typeLabel[selectedHead.head_type]}</p></div>
          <div className="inline-actions"><StatusPill value={selectedHead.is_active ? "active" : "inactive"} /><Link className="button secondary small" href="/settings/payroll-heads">Close</Link></div>
        </div>

        {selectedMode === "edit" ? <>
          <form action={savePayrollHead}>
            <input name="id" type="hidden" value={selectedHead.id} />
            <div className="master-entry-grid payroll-head-edit">
              <div className="field"><label htmlFor={`head-name-${selectedHead.id}`}>Name</label><input id={`head-name-${selectedHead.id}`} name="name" defaultValue={selectedHead.name} required /></div>
              <div className="field"><label>Code</label><input value={selectedHead.code} disabled /></div>
              <div className="field"><label htmlFor={`head-type-${selectedHead.id}`}>Pay type</label><SearchableSelect id={`head-type-${selectedHead.id}`} name="head_type" options={payTypeOptions} defaultValue={selectedHead.head_type} placeholder="Search pay type" required /></div>
              <SubmitButton className="button primary" pendingLabel="Saving payroll head…">Save payroll head</SubmitButton>
            </div>
          </form>
          <form action={togglePayrollHead} className="payroll-head-status-form">
            <input name="id" type="hidden" value={selectedHead.id} />
            <input name="next_active" type="hidden" value={selectedHead.is_active ? "false" : "true"} />
            <div><strong>{selectedHead.is_active ? "Deactivate payroll head" : "Activate payroll head"}</strong><p>{selectedHead.is_active ? "Inactive heads are no longer available for new salary configurations." : "Make this head available for salary configurations again."}</p></div>
            <SubmitButton className={selectedHead.is_active ? "button danger small" : "button secondary small"} pendingLabel={selectedHead.is_active ? "Deactivating…" : "Activating…"}>{selectedHead.is_active ? "Deactivate" : "Activate"}</SubmitButton>
          </form>
        </> : <dl className="details-grid payroll-head-view">
          <div><dt>Name</dt><dd>{selectedHead.name}</dd></div>
          <div><dt>Code</dt><dd><code>{selectedHead.code}</code></dd></div>
          <div><dt>Pay type</dt><dd>{typeLabel[selectedHead.head_type]}</dd></div>
          <div><dt>Source</dt><dd>{selectedHead.is_system ? "Protected system head" : "Custom payroll head"}</dd></div>
        </dl>}
      </div> : null}
    </section>
  </AppShell>;
}
