import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { PayrollHeadRowActions } from "@/components/payroll-head-row-actions";
import { SearchableSelect } from "@/components/searchable-select";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { loadPayrollSettings } from "@/lib/payroll";
import { payrollHeadPayTypeOptions, payrollHeadTypeLabel } from "@/lib/payroll-head-options";
import { createPayrollHead } from "./actions";

export const metadata: Metadata = { title: "Payroll heads" };

export default async function PayrollHeadsPage() {
  const auth = await requireHrmsAuth("settings.manage");
  const { heads } = await loadPayrollSettings(auth);
  const customHeads = heads.filter((head) => !head.is_system);

  return <>
    <PageHeader
      eyebrow="Settings"
      title="Payroll heads"
      description="Create the reusable earning, deduction and statutory components used in salary configurations."
      action={<Link className="button secondary" href="/settings">Settings</Link>}
    />

    <section className="grid stats-grid">
      <article className="card stat"><span className="stat-label">Total heads</span><strong className="stat-value">{heads.length}</strong><span className="stat-meta">Including protected CTC</span></article>
      <article className="card stat"><span className="stat-label">Active custom heads</span><strong className="stat-value">{customHeads.filter((head) => head.is_active).length}</strong><span className="stat-meta">Available for configurations</span></article>
      <article className="card stat"><span className="stat-label">Pay types</span><strong className="stat-value">4</strong><span className="stat-meta">Earnings, deductions and statutory</span></article>
      <article className="card stat"><span className="stat-label">Protected head</span><strong className="stat-value text-value">CTC</strong><span className="stat-meta">Cost to the company</span></article>
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Add payroll head</h2><p className="panel-subtitle">Code is permanent and can be used inside salary equations.</p></div></div>
      <div className="panel-body payroll-head-create-body">
        <ActionForm action={createPayrollHead}>
          <div className="master-entry-grid payroll-head-create">
            <div className="field"><label htmlFor="payroll-head-name">Name *</label><input id="payroll-head-name" name="name" placeholder="Basic Salary" required /></div>
            <div className="field"><label htmlFor="payroll-head-code">Code *</label><input id="payroll-head-code" name="code" placeholder="BASIC_SALARY" required /><small>Letters, numbers and underscores only.</small></div>
            <div className="field"><label htmlFor="payroll-head-type">Pay type *</label><SearchableSelect id="payroll-head-type" name="head_type" options={payrollHeadPayTypeOptions} placeholder="Search pay type" required /></div>
            <SubmitButton className="button primary" pendingLabel="Creating payroll head…">Create payroll head</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </section>

    <section className="panel payroll-head-master" style={{ marginTop: 18 }}>
      <div className="panel-head"><div><h2>Payroll head master</h2><p className="panel-subtitle">View and maintain every system and custom payroll head from one master.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Code</th><th>Pay type</th><th>Source</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {heads.map((head) => <tr key={head.id}>
          <td><strong>{head.name}</strong></td>
          <td><code>{head.code}</code></td>
          <td>{payrollHeadTypeLabel[head.head_type]}</td>
          <td>{head.is_system ? <span className="system-badge">System</span> : "Custom"}</td>
          <td><StatusPill value={head.is_active ? "active" : "inactive"} /></td>
          <td><PayrollHeadRowActions head={head} canEdit={!head.is_system} /></td>
        </tr>)}
      </tbody></table></div>
    </section>
  </>;
}
