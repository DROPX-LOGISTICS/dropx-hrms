import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { StatutorySlabsEditor } from "@/components/statutory-slabs-editor";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { loadStatutorySettings } from "@/lib/statutory";
import { saveStatutorySettings } from "./actions";

export const metadata: Metadata = { title: "Statutory settings" };

export default async function StatutorySettingsPage() {
  const auth = await requireHrmsAuth("settings.manage");
  const settings = await loadStatutorySettings(auth);

  return <>
    <PageHeader
      eyebrow="Settings"
      title="Statutory settings"
      description="Configure the PF, ESI, professional tax and TDS parameters used when the Salary Process calculates each payroll run."
      action={<Link className="button secondary" href="/settings">Settings</Link>}
    />

    <ActionForm action={saveStatutorySettings}>
      <section className="panel">
        <div className="panel-head"><div><h2>Provident Fund (PF)</h2><p className="panel-subtitle">Applied only to payees whose statutory applicability includes PF.</p></div>
          <label className="checkbox-row"><input type="checkbox" name="pf_enabled" defaultChecked={settings.pfEnabled} /> Enabled</label>
        </div>
        <div className="panel-body form-grid">
          <div className="field"><label htmlFor="pf_employee_rate">Employee contribution rate (%)</label><input id="pf_employee_rate" name="pf_employee_rate" type="number" min="0" max="100" step="0.01" defaultValue={settings.pfEmployeeRate} required /></div>
          <div className="field"><label htmlFor="pf_employer_rate">Employer contribution rate (%)</label><input id="pf_employer_rate" name="pf_employer_rate" type="number" min="0" max="100" step="0.01" defaultValue={settings.pfEmployerRate} required /></div>
          <div className="field"><label htmlFor="pf_wage_ceiling">PF wage ceiling (₹ per month)</label><input id="pf_wage_ceiling" name="pf_wage_ceiling" type="number" min="0" step="1" defaultValue={settings.pfWageCeiling} required /><small>PF is computed on the lower of Basic Salary and this ceiling.</small></div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><div><h2>Employee State Insurance (ESI)</h2><p className="panel-subtitle">Applies only when gross wages are at or below the ceiling and the payee is ESI-applicable.</p></div>
          <label className="checkbox-row"><input type="checkbox" name="esi_enabled" defaultChecked={settings.esiEnabled} /> Enabled</label>
        </div>
        <div className="panel-body form-grid">
          <div className="field"><label htmlFor="esi_employee_rate">Employee contribution rate (%)</label><input id="esi_employee_rate" name="esi_employee_rate" type="number" min="0" max="100" step="0.01" defaultValue={settings.esiEmployeeRate} required /></div>
          <div className="field"><label htmlFor="esi_employer_rate">Employer contribution rate (%)</label><input id="esi_employer_rate" name="esi_employer_rate" type="number" min="0" max="100" step="0.01" defaultValue={settings.esiEmployerRate} required /></div>
          <div className="field"><label htmlFor="esi_wage_ceiling">ESI wage ceiling (₹ per month)</label><input id="esi_wage_ceiling" name="esi_wage_ceiling" type="number" min="0" step="1" defaultValue={settings.esiWageCeiling} required /></div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><div><h2>Professional tax (PT)</h2><p className="panel-subtitle">Matched against each payee&apos;s monthly gross salary.</p></div>
          <label className="checkbox-row"><input type="checkbox" name="pt_enabled" defaultChecked={settings.ptEnabled} /> Enabled</label>
        </div>
        <div className="panel-body"><StatutorySlabsEditor slabs={settings.ptSlabs} /></div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><div><h2>Income tax (TDS)</h2><p className="panel-subtitle">Automatic slab-based TDS is not yet computed. When enabled, add the monthly TDS amount manually for each payee before locking a run.</p></div>
          <label className="checkbox-row"><input type="checkbox" name="tds_enabled" defaultChecked={settings.tdsEnabled} /> Enabled</label>
        </div>
      </section>

      <div className="form-actions"><SubmitButton className="button primary" pendingLabel="Saving statutory settings…">Save statutory settings</SubmitButton></div>
    </ActionForm>
  </>;
}
