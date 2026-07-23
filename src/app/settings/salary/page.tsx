import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SalaryConfigurationEditor } from "@/components/salary-configuration-editor";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { loadPayrollSettings } from "@/lib/payroll";
import { createSalaryConfiguration } from "./actions";

export const metadata: Metadata = { title: "Salary configuration" };
export const dynamic = "force-dynamic";

export default async function SalarySettingsPage({ searchParams }: { searchParams?: { error?: string; notice?: string } }) {
  const auth = await requireHrmsAuth("settings.manage");
  const { heads, configurations } = await loadPayrollSettings(auth);
  const activeHeads = heads.filter((head) => head.is_active);
  return <AppShell auth={auth} active="Salary Configuration">
    <PageHeader
      eyebrow="Settings"
      title="Salary configuration"
      description="Create multiple salary structures and define the payroll heads, values and permitted ranges for each."
      action={<Link className="button secondary" href="/settings/payroll-heads">Payroll heads</Link>}
    />
    {searchParams?.error ? <div className="alert error">{searchParams.error}</div> : null}
    {searchParams?.notice ? <div className="alert success">{searchParams.notice}</div> : null}

    <section className="grid stats-grid">
      <article className="card stat"><span className="stat-label">Configurations</span><strong className="stat-value">{configurations.length}</strong><span className="stat-meta">Reusable salary structures</span></article>
      <article className="card stat"><span className="stat-label">Available payroll heads</span><strong className="stat-value">{activeHeads.length}</strong><span className="stat-meta">Including protected CTC</span></article>
      <article className="card stat"><span className="stat-label">Custom payroll heads</span><strong className="stat-value">{activeHeads.filter((head) => !head.is_system).length}</strong><span className="stat-meta">Across four pay types</span></article>
      <article className="card stat"><span className="stat-label">Value methods</span><strong className="stat-value text-value">3</strong><span className="stat-meta">Constant, equation or custom</span></article>
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Create salary configuration</h2><p className="panel-subtitle">Create the configuration first, then add its payroll heads in the table below.</p></div></div>
      <div className="panel-body">
        <form action={createSalaryConfiguration}>
          <div className="master-entry-grid salary-config-create">
            <div className="field"><label htmlFor="salary-configuration-code">Configuration code *</label><input id="salary-configuration-code" name="code" placeholder="MONTHLY_STAFF" required /><small>Permanent reference code.</small></div>
            <div className="field"><label htmlFor="salary-configuration-name">Configuration name *</label><input id="salary-configuration-name" name="name" placeholder="Monthly Staff Salary" required /></div>
            <SubmitButton className="button primary" pendingLabel="Creating salary configuration…">Create configuration</SubmitButton>
          </div>
        </form>
      </div>
    </section>

    <section className="master-section">
      <div className="section-heading"><div><p className="eyebrow">Configuration master</p><h2>Salary configurations</h2><p>Select payroll heads and define a constant, equation or employee-specific custom value.</p></div></div>
      <div className="salary-config-list">
        {configurations.length
          ? configurations.map((configuration) => <SalaryConfigurationEditor key={configuration.id} configuration={configuration} heads={heads} />)
          : <div className="alert">No salary configuration exists. Create the first configuration above.</div>}
      </div>
    </section>
  </AppShell>;
}
