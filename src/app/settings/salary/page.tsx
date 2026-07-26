import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  CreateSalaryConfigurationEditor,
  SalaryConfigurationList
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

    <section className="salary-create-workspace">
      <div className="salary-create-workspace-head">
        <div>
          <h2>Create salary configuration</h2>
          <p className="panel-subtitle">Enter the details, add every salary component and save the complete configuration in one step.</p>
        </div>
      </div>
      <CreateSalaryConfigurationEditor heads={activeHeads} />
    </section>

    <section className="panel salary-configuration-master">
      <div className="panel-head">
        <div>
          <h2>Saved salary configurations</h2>
          <p className="panel-subtitle">Open any configuration from the action menu to view or edit it.</p>
        </div>
      </div>
      <div className="panel-body salary-configuration-master-body">
        <SalaryConfigurationList configurations={configurations} heads={heads} />
      </div>
    </section>
  </AppShell>;
}
