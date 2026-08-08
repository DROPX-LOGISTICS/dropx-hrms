import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { PACKAGE_TYPE_LABELS, PACKAGE_TYPES } from "@/lib/package-types";
import { loadPayrollSettings } from "@/lib/payroll";
import { listPackageRateDefaults } from "@/lib/payroll-run";
import { savePackageRateDefaultsAction } from "./actions";

const CreateSalaryConfigurationEditor = dynamic(
  () => import("@/components/salary-configuration-editor").then((mod) => mod.CreateSalaryConfigurationEditor),
  { loading: () => <div className="content-loading"><div className="content-loading-panel" /></div> }
);
const SalaryConfigurationList = dynamic(
  () => import("@/components/salary-configuration-editor").then((mod) => mod.SalaryConfigurationList),
  { loading: () => <div className="content-loading"><div className="content-loading-panel" /></div> }
);

export const metadata: Metadata = { title: "Salary configuration" };

export default async function SalarySettingsPage() {
  const auth = await requireHrmsAuth("settings.manage");
  const [{ heads, configurations }, packageRates] = await Promise.all([
    loadPayrollSettings(auth),
    listPackageRateDefaults(auth)
  ]);
  const activeHeads = heads.filter((head) => head.is_active);
  const rateByType = new Map(packageRates.map((row) => [row.package_type, Number(row.rate)]));

  return <>
    <PageHeader
      eyebrow="Settings"
      title="Salary configuration"
      description="Create reusable salary structures and set company default rates for package-based pay."
      action={<Link className="button secondary" href="/settings/payroll-heads">Payroll heads</Link>}
    />

    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Package rate defaults</h2>
          <p className="panel-subtitle">Used for delivery and pickup package pay. Members can override these rates on their payroll line.</p>
        </div>
      </div>
      <div className="panel-body">
        <ActionForm action={savePackageRateDefaultsAction} className="form-grid">
          {PACKAGE_TYPES.map((type) => (
            <div className="field" key={type}>
              <label htmlFor={`rate-${type}`}>{PACKAGE_TYPE_LABELS[type]} (₹ / unit)</label>
              <input
                id={`rate-${type}`}
                name={`rate_${type}`}
                type="number"
                min="0"
                step="0.01"
                defaultValue={rateByType.get(type) ?? 0}
                required
              />
            </div>
          ))}
          <div style={{ alignSelf: "end" }}>
            <SubmitButton className="button primary" pendingLabel="Saving…">Save package rates</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </section>

    <section className="salary-create-workspace" style={{ marginTop: 16 }}>
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
  </>;
}
