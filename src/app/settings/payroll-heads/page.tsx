import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
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

export default async function PayrollHeadsPage({ searchParams }: { searchParams?: { error?: string; notice?: string } }) {
  const auth = await requireHrmsAuth("settings.manage");
  const { heads } = await loadPayrollSettings(auth);
  const customHeads = heads.filter((head) => !head.is_system);
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
      <div className="panel-body">
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

    <section className="panel" style={{ marginTop: 18 }}>
      <div className="panel-head"><h2>Payroll head master</h2></div>
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Code</th><th>Pay type</th><th>Source</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {heads.map((head) => <tr key={head.id}>
          <td><strong>{head.name}</strong></td>
          <td><code>{head.code}</code></td>
          <td>{typeLabel[head.head_type]}</td>
          <td>{head.is_system ? <span className="system-badge">System</span> : "Custom"}</td>
          <td><StatusPill value={head.is_active ? "active" : "inactive"} /></td>
          <td>{head.is_system ? <span className="locked-label">Protected</span> : <form action={togglePayrollHead}><input name="id" type="hidden" value={head.id} /><input name="next_active" type="hidden" value={head.is_active ? "false" : "true"} /><SubmitButton className="button secondary small" pendingLabel={head.is_active ? "Deactivating…" : "Activating…"}>{head.is_active ? "Deactivate" : "Activate"}</SubmitButton></form>}</td>
        </tr>)}
      </tbody></table></div>
    </section>

    {customHeads.length ? <section className="panel" style={{ marginTop: 18 }}>
      <div className="panel-head"><h2>Edit custom payroll heads</h2></div>
      <div className="panel-body"><div className="master-accordion">
        {customHeads.map((head) => <details key={head.id}>
          <summary><span><strong>{head.name}</strong><small>{head.code} · {typeLabel[head.head_type]}</small></span><StatusPill value={head.is_active ? "active" : "inactive"} /></summary>
          <form action={savePayrollHead}><input name="id" type="hidden" value={head.id} /><div className="master-entry-grid payroll-head-edit">
            <div className="field"><label htmlFor={`head-name-${head.id}`}>Name</label><input id={`head-name-${head.id}`} name="name" defaultValue={head.name} required /></div>
            <div className="field"><label>Code</label><input value={head.code} disabled /></div>
            <div className="field"><label htmlFor={`head-type-${head.id}`}>Pay type</label><SearchableSelect id={`head-type-${head.id}`} name="head_type" options={payTypeOptions} defaultValue={head.head_type} placeholder="Search pay type" required /></div>
            <SubmitButton className="button primary" pendingLabel="Saving payroll head…">Save payroll head</SubmitButton>
          </div></form>
        </details>)}
      </div></div>
    </section> : null}
  </AppShell>;
}
