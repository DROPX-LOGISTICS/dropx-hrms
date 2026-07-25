import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  CreateSalaryConfigurationEditor,
  SalaryConfigurationEditor
} from "@/components/salary-configuration-editor";
import { requireHrmsAuth } from "@/lib/auth";
import { loadPayrollSettings } from "@/lib/payroll";

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
      description="Create reusable salary structures with guided calculation methods and permitted ranges."
      action={<Link className="button secondary" href="/settings/payroll-heads">Payroll heads</Link>}
    />
    {searchParams?.error ? <div className="alert error">{searchParams.error}</div> : null}
    {searchParams?.notice ? <div className="alert success">{searchParams.notice}</div> : null}

    <section className="grid stats-grid">
      <article className="card stat"><span className="stat-label">Configurations</span><strong className="stat-value">{configurations.length}</strong><span className="stat-meta">Reusable salary structures</span></article>
      <article className="card stat"><span className="stat-label">Available payroll heads</span><strong className="stat-value">{activeHeads.length}</strong><span className="stat-meta">Including protected CTC</span></article>
      <article className="card stat"><span className="stat-label">Custom payroll heads</span><strong className="stat-value">{activeHeads.filter((head) => !head.is_system).length}</strong><span className="stat-meta">Across four pay types</span></article>
      <article className="card stat"><span className="stat-label">Calculation methods</span><strong className="stat-value text-value">4</strong><span className="stat-meta">Input, fixed, percentage or advanced</span></article>
    </section>

    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Create salary configuration</h2>
          <p className="panel-subtitle">Enter the details, add every salary component and save the complete configuration in one step.</p>
        </div>
      </div>
      <div className="panel-body">
        <CreateSalaryConfigurationEditor heads={activeHeads} />
      </div>
    </section>

    <section className="master-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Configuration master</p>
          <h2>Saved salary configurations</h2>
          <p>Review or update components using guided calculation methods.</p>
        </div>
      </div>
      <div className="salary-config-list">
        {configurations.length
          ? configurations.map((configuration) => <SalaryConfigurationEditor key={configuration.id} configuration={configuration} heads={heads} />)
          : <div className="alert">No salary configuration exists. Create the first complete configuration above.</div>}
      </div>
    </section>
  </AppShell>;
}
