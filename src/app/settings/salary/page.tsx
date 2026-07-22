import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SalaryConfigurationEditor } from "@/components/salary-configuration-editor";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { loadPayrollSettings, PayrollHeadRow } from "@/lib/payroll";
import { createPayrollHead, createSalaryConfiguration, savePayrollHead, togglePayrollHead } from "./actions";

export const metadata: Metadata = { title: "Salary configuration" };
export const dynamic = "force-dynamic";
const typeLabel: Record<PayrollHeadRow["head_type"], string> = { ctc: "CTC", earning: "Earning", deduction: "Deduction", employer_contribution: "Employer contribution", reimbursement: "Reimbursement" };

export default async function SalarySettingsPage({ searchParams }: { searchParams?: { error?: string; notice?: string } }) {
  const auth = await requireHrmsAuth("settings.manage");
  const { heads, configurations } = await loadPayrollSettings(auth);
  const activeHeads = heads.filter((head) => head.is_active);
  const customHeads = heads.filter((head) => !head.is_system);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <AppShell auth={auth} active="Salary Configuration">
    <PageHeader eyebrow="Payroll masters" title="Salary configuration" description="Create payroll heads and define reusable CTC equations without hard-coded company policy." action={<Link className="button secondary" href="/settings">HR settings</Link>} />
    {searchParams?.error ? <div className="alert error">{searchParams.error}</div> : null}
    {searchParams?.notice ? <div className="alert success">{searchParams.notice}</div> : null}

    <section className="grid stats-grid payroll-stats">
      <article className="card stat"><span className="stat-label">Active pay heads</span><strong className="stat-value">{activeHeads.length}</strong><span className="stat-meta">2 protected system heads</span></article>
      <article className="card stat"><span className="stat-label">Custom pay heads</span><strong className="stat-value">{customHeads.length}</strong><span className="stat-meta">Earnings, deductions and benefits</span></article>
      <article className="card stat"><span className="stat-label">Salary configurations</span><strong className="stat-value">{configurations.length}</strong><span className="stat-meta">Effective-dated structures</span></article>
      <article className="card stat"><span className="stat-label">Default configuration</span><strong className="stat-value text-value">{configurations.find((configuration) => configuration.is_default)?.code ?? "—"}</strong><span className="stat-meta">Used for new salary assignments</span></article>
    </section>

    <nav className="master-tabs"><a href="#pay-heads">Payroll head master</a><a href="#new-configuration">New configuration</a><a href="#equations">Pay head equations</a></nav>

    <section className="panel master-section" id="pay-heads">
      <div className="panel-head"><div><h2>Payroll head master</h2><p className="panel-subtitle">CTC and Basic Salary are permanent system heads. Add any number of company-specific heads below.</p></div></div>
      <div className="panel-body">
        <form action={createPayrollHead}><div className="master-entry-grid payroll-head-entry">
          <div className="field"><label htmlFor="pay-head-name">Name</label><input id="pay-head-name" name="name" placeholder="House Rent Allowance" required /></div>
          <div className="field"><label htmlFor="pay-head-code">Code</label><input id="pay-head-code" name="code" placeholder="HRA" required /><small>Code becomes an equation reference.</small></div>
          <div className="field"><label htmlFor="pay-head-type">Type</label><select id="pay-head-type" name="head_type" defaultValue="earning"><option value="earning">Earning</option><option value="deduction">Deduction</option><option value="employer_contribution">Employer contribution</option><option value="reimbursement">Reimbursement</option></select></div>
          <div className="field"><label htmlFor="pay-head-order">Order</label><input id="pay-head-order" name="display_order" type="number" min="0" max="9999" defaultValue="100" required /></div>
          <SubmitButton className="button primary" pendingLabel="Creating pay head…">Create pay head</SubmitButton>
        </div></form>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Pay head</th><th>Code</th><th>Type</th><th>Source</th><th>Status</th><th>Action</th></tr></thead><tbody>{heads.map((head) => <tr key={head.id}><td><strong>{head.name}</strong></td><td><code>{head.code}</code></td><td>{typeLabel[head.head_type]}</td><td>{head.is_system ? <span className="system-badge">System</span> : "Custom"}</td><td><StatusPill value={head.is_active ? "active" : "inactive"} /></td><td>{head.is_system ? <span className="locked-label">Protected</span> : <form action={togglePayrollHead}><input name="id" type="hidden" value={head.id} /><input name="next_active" type="hidden" value={head.is_active ? "false" : "true"} /><SubmitButton className="button secondary small" pendingLabel={head.is_active ? "Deactivating…" : "Activating…"}>{head.is_active ? "Deactivate" : "Activate"}</SubmitButton></form>}</td></tr>)}</tbody></table></div>
      {customHeads.length ? <div className="panel-body payroll-head-editors"><h3>Edit custom heads</h3><div className="master-accordion">{customHeads.map((head) => <details key={head.id}><summary><span><strong>{head.name}</strong><small>{head.code} · {typeLabel[head.head_type]}</small></span><StatusPill value={head.is_active ? "active" : "inactive"} /></summary><form action={savePayrollHead}><input name="id" type="hidden" value={head.id} /><div className="master-entry-grid"><div className="field"><label>Name</label><input name="name" defaultValue={head.name} required /></div><div className="field"><label>Code</label><input value={head.code} disabled /></div><div className="field"><label>Type</label><select name="head_type" defaultValue={head.head_type}><option value="earning">Earning</option><option value="deduction">Deduction</option><option value="employer_contribution">Employer contribution</option><option value="reimbursement">Reimbursement</option></select></div><div className="field"><label>Order</label><input name="display_order" type="number" min="0" max="9999" defaultValue={head.display_order} required /></div><SubmitButton className="button primary" pendingLabel="Saving pay head…">Save pay head</SubmitButton></div></form></details>)}</div></div> : null}
    </section>

    <section className="panel master-section" id="new-configuration">
      <div className="panel-head"><div><h2>New salary configuration</h2><p className="panel-subtitle">Create another effective-dated structure for a business unit, grade or future policy.</p></div></div>
      <div className="panel-body"><form action={createSalaryConfiguration}><div className="master-entry-grid salary-new-config">
        <div className="field"><label htmlFor="salary-config-name">Name</label><input id="salary-config-name" name="name" placeholder="FY 2026 Standard" required /></div>
        <div className="field"><label htmlFor="salary-config-code">Code</label><input id="salary-config-code" name="code" placeholder="FY26_STANDARD" required /></div>
        <div className="field"><label htmlFor="salary-config-from">Effective from</label><input id="salary-config-from" name="effective_from" type="date" defaultValue={today} required /></div>
        <div className="field wide"><label htmlFor="salary-config-description">Description</label><input id="salary-config-description" name="description" placeholder="Employees covered by this structure" /></div>
        <SubmitButton className="button primary" pendingLabel="Creating configuration…">Create configuration</SubmitButton>
      </div></form></div>
    </section>

    <section className="master-section" id="equations">
      <div className="section-heading"><div><p className="eyebrow">Equation builder</p><h2>Salary configurations</h2><p>Define annual values. Monthly previews use the configuration’s annualisation factor.</p></div></div>
      <div className="salary-config-list">{configurations.length ? configurations.map((configuration) => <SalaryConfigurationEditor key={configuration.id} configuration={configuration} heads={activeHeads} />) : <div className="alert">No salary configuration exists yet.</div>}</div>
    </section>
  </AppShell>;
}
