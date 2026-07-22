"use client";

import { useMemo, useState } from "react";
import { saveSalaryConfiguration } from "@/app/settings/salary/actions";
import { SubmitButton } from "@/components/submit-button";
import { calculatePayrollConfiguration, PayrollCalculationType } from "@/lib/payroll-formula";
import { PayrollHeadRow, SalaryConfigurationRow } from "@/lib/payroll";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const typeLabel: Record<PayrollHeadRow["head_type"], string> = { ctc: "CTC", earning: "Earning", deduction: "Deduction", employer_contribution: "Employer contribution", reimbursement: "Reimbursement" };

export function SalaryConfigurationEditor({ configuration, heads }: { configuration: SalaryConfigurationRow; heads: PayrollHeadRow[] }) {
  const itemByHead = new Map(configuration.hr_salary_configuration_items.map((item) => [item.payroll_head_id, item]));
  const [ctc, setCtc] = useState(600000);
  const [factor, setFactor] = useState(configuration.annualisation_factor);
  const [formulas, setFormulas] = useState<Record<string, string>>(() => Object.fromEntries(heads.map((head) => [head.id, itemByHead.get(head.id)?.formula ?? (head.code === "BASIC_SALARY" ? "CTC * 50%" : "0")])));
  const [fixedAmounts, setFixedAmounts] = useState<Record<string, number>>(() => Object.fromEntries(heads.map((head) => [head.id, itemByHead.get(head.id)?.fixed_amount ?? 0])));
  const [calculationTypes, setCalculationTypes] = useState<Record<string, PayrollCalculationType>>(() => Object.fromEntries(heads.map((head) => [head.id, head.code === "CTC" ? "input" : head.code === "BASIC_SALARY" ? "formula" : itemByHead.get(head.id)?.calculation_type ?? "formula"])));
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(heads.map((head) => [head.id, head.is_system || itemByHead.get(head.id)?.is_enabled !== false])));

  const preview = useMemo(() => {
    try {
      const values = calculatePayrollConfiguration(heads.map((head) => ({
        code: head.code,
        calculationType: head.code === "CTC" ? "input" : head.code === "BASIC_SALARY" ? "formula" : calculationTypes[head.id],
        formula: formulas[head.id],
        fixedAmount: fixedAmounts[head.id]
      })), { CTC: ctc });
      return { values, error: null };
    } catch (error) {
      return { values: {} as Record<string, number>, error: error instanceof Error ? error.message : "Unable to calculate preview." };
    }
  }, [calculationTypes, ctc, fixedAmounts, formulas, heads]);

  return (
    <details className="salary-config-card" open={configuration.is_default}>
      <summary>
        <span><strong>{configuration.name}</strong><small>{configuration.code} · Effective {configuration.effective_from}</small></span>
        <span className="config-badges">{configuration.is_default ? <em>Default</em> : null}<em className={configuration.is_active ? "active" : "inactive"}>{configuration.is_active ? "Active" : "Inactive"}</em></span>
      </summary>
      <form action={saveSalaryConfiguration}>
        <input name="configuration_id" type="hidden" value={configuration.id} />
        <div className="form-grid salary-config-meta">
          <div className="field"><label htmlFor={`name-${configuration.id}`}>Configuration name</label><input id={`name-${configuration.id}`} name="name" defaultValue={configuration.name} required /></div>
          <div className="field"><label>Code</label><input value={configuration.code} disabled /></div>
          <div className="field"><label htmlFor={`from-${configuration.id}`}>Effective from</label><input id={`from-${configuration.id}`} name="effective_from" type="date" defaultValue={configuration.effective_from} required /></div>
          <div className="field"><label htmlFor={`to-${configuration.id}`}>Effective to</label><input id={`to-${configuration.id}`} name="effective_to" type="date" defaultValue={configuration.effective_to ?? ""} /></div>
          <div className="field"><label htmlFor={`factor-${configuration.id}`}>Annualisation factor</label><input id={`factor-${configuration.id}`} name="annualisation_factor" type="number" min="1" max="365" value={factor} onChange={(event) => setFactor(Number(event.target.value) || 12)} required /><small>12 converts annual heads to monthly amounts.</small></div>
          <div className="field wide"><label htmlFor={`description-${configuration.id}`}>Description</label><input id={`description-${configuration.id}`} name="description" defaultValue={configuration.description ?? ""} /></div>
          <label className="checkbox-row"><input name="is_default" type="checkbox" defaultChecked={configuration.is_default} /> Default configuration</label>
          <label className="checkbox-row"><input name="is_active" type="checkbox" defaultChecked={configuration.is_active} /> Active</label>
        </div>

        <div className="salary-equation-toolbar">
          <div><strong>Pay head equations</strong><p>Use pay head codes, arithmetic and percentages. Example: <code>BASIC_SALARY * 40%</code>.</p></div>
          <div className="reference-chips" aria-label="Available equation references">{heads.map((head) => <code key={head.id}>{head.code}</code>)}</div>
        </div>

        <div className="salary-equation-grid salary-equation-head"><span>Pay head</span><span>Method</span><span>Equation / amount</span><span>Annual preview</span><span>Monthly preview</span><span>Use</span></div>
        {heads.map((head) => {
          const method = head.code === "CTC" ? "input" : head.code === "BASIC_SALARY" ? "formula" : calculationTypes[head.id];
          const annual = preview.values[head.code];
          return <div className="salary-equation-grid" key={head.id}>
            <div className="pay-head-name"><strong>{head.name}</strong><small>{head.code} · {typeLabel[head.head_type]}</small></div>
            <div>
              {head.code === "CTC" ? <span className="method-label">CTC input</span> : head.code === "BASIC_SALARY" ? <><input name={`calculation_type:${head.id}`} type="hidden" value="formula" /><span className="method-label">Equation</span></> : <select aria-label={`${head.name} calculation method`} name={`calculation_type:${head.id}`} value={method} onChange={(event) => setCalculationTypes((current) => ({ ...current, [head.id]: event.target.value as PayrollCalculationType }))}><option value="formula">Equation</option><option value="fixed">Fixed annual amount</option></select>}
            </div>
            <div>
              {head.code === "CTC" ? <span className="method-label">Entered when assigning salary</span> : method === "fixed" ? <input aria-label={`${head.name} fixed amount`} name={`fixed_amount:${head.id}`} type="number" min="0" step="0.01" value={fixedAmounts[head.id]} onChange={(event) => setFixedAmounts((current) => ({ ...current, [head.id]: Number(event.target.value) }))} required /> : <input aria-label={`${head.name} equation`} className="formula-input" name={`formula:${head.id}`} value={formulas[head.id]} onChange={(event) => setFormulas((current) => ({ ...current, [head.id]: event.target.value }))} placeholder="CTC * 10%" required />}
            </div>
            <strong className="preview-amount">{Number.isFinite(annual) ? currency.format(annual) : "—"}</strong>
            <span className="preview-amount">{Number.isFinite(annual) && factor > 0 ? currency.format(annual / factor) : "—"}</span>
            <label className="equation-enabled"><input name={`enabled:${head.id}`} type="checkbox" checked={head.is_system || enabled[head.id]} disabled={head.is_system} onChange={(event) => setEnabled((current) => ({ ...current, [head.id]: event.target.checked }))} />{head.is_system ? <input name={`enabled:${head.id}`} type="hidden" value="on" /> : null}</label>
          </div>;
        })}
        <div className="salary-preview-bar">
          <div className="field"><label htmlFor={`ctc-${configuration.id}`}>Preview annual CTC</label><input id={`ctc-${configuration.id}`} type="number" min="0" step="1000" value={ctc} onChange={(event) => setCtc(Number(event.target.value))} /></div>
          <div className={preview.error ? "formula-status error" : "formula-status success"}>{preview.error ?? "All equations are valid. Preview recalculates instantly."}</div>
          <SubmitButton className="button primary" pendingLabel="Saving equations…">Save configuration</SubmitButton>
        </div>
      </form>
    </details>
  );
}
