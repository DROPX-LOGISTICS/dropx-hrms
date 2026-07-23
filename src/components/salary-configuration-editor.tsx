"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveSalaryConfiguration } from "@/app/settings/salary/actions";
import { SearchableSelect } from "@/components/searchable-select";
import { SubmitButton } from "@/components/submit-button";
import { PayrollHeadRow, SalaryConfigurationRow } from "@/lib/payroll";

type EditorRow = {
  key: string;
  payrollHeadId: string;
  valueExpression: string;
  minimumValue: string;
  maximumValue: string;
};

const typeLabel: Record<PayrollHeadRow["head_type"], string> = {
  ctc: "System CTC",
  employee_earning: "Employee Earning",
  employee_deduction: "Employee Deduction",
  statutory_deduction: "Statutory Deduction",
  statutory_contribution: "Statutory Contribution"
};

function initialRows(configuration: SalaryConfigurationRow, heads: PayrollHeadRow[]): EditorRow[] {
  const rows = configuration.hr_salary_configuration_items.map((item) => ({
    key: item.id,
    payrollHeadId: item.payroll_head_id,
    valueExpression: item.value_expression ?? item.formula ?? (item.fixed_amount === null ? "" : String(item.fixed_amount)),
    minimumValue: item.minimum_value === null ? "" : String(item.minimum_value),
    maximumValue: item.maximum_value === null ? "" : String(item.maximum_value)
  }));
  if (!rows.some((row) => heads.find((head) => head.id === row.payrollHeadId)?.code === "CTC")) {
    const ctc = heads.find((head) => head.code === "CTC");
    if (ctc) rows.unshift({ key: `ctc-${ctc.id}`, payrollHeadId: ctc.id, valueExpression: "", minimumValue: "", maximumValue: "" });
  }
  return rows;
}

export function SalaryConfigurationEditor({ configuration, heads }: { configuration: SalaryConfigurationRow; heads: PayrollHeadRow[] }) {
  const [rows, setRows] = useState<EditorRow[]>(() => initialRows(configuration, heads));
  const rowSequence = useRef(0);
  const selectedIds = new Set(rows.map((row) => row.payrollHeadId).filter(Boolean));

  function updateRow(key: string, values: Partial<EditorRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...values } : row));
  }
  function addRow() {
    rowSequence.current += 1;
    setRows((current) => [...current, {
      key: `new-${Date.now()}-${rowSequence.current}`,
      payrollHeadId: "",
      valueExpression: "",
      minimumValue: "",
      maximumValue: ""
    }]);
  }
  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return <details className="salary-config-card" open>
    <summary>
      <span><strong>{configuration.name}</strong><small>Configuration code: {configuration.code}</small></span>
      <span className="config-badges"><em className="active">{rows.length} payroll {rows.length === 1 ? "head" : "heads"}</em></span>
    </summary>
    <form action={saveSalaryConfiguration}>
      <input name="configuration_id" type="hidden" value={configuration.id} />
      <div className="salary-definition-toolbar">
        <div><strong>Payroll head values</strong><p>Add only the heads required for this salary structure. CTC remains the protected custom input.</p></div>
        <button className="button secondary small" type="button" onClick={addRow}><Plus size={14} /> Add payroll head</button>
      </div>
      <div className="table-wrap">
        <table className="salary-definition-table">
          <thead><tr>
            <th>Payroll head</th>
            <th>Value <small>Enter a constant value or define an equation, or leave blank for custom.</small></th>
            <th>Minimum value</th>
            <th>Maximum value</th>
            <th>Action</th>
          </tr></thead>
          <tbody>
            {rows.map((row) => {
              const selectedHead = heads.find((head) => head.id === row.payrollHeadId);
              const isCtc = selectedHead?.code === "CTC";
              const options = heads
                .filter((head) => (head.is_active || head.id === row.payrollHeadId) && (!selectedIds.has(head.id) || head.id === row.payrollHeadId))
                .map((head) => ({ value: head.id, label: `${head.name} · ${head.code} · ${typeLabel[head.head_type]}${head.is_active ? "" : " · Inactive"}` }));
              return <tr key={row.key}>
                <td>
                  <SearchableSelect
                    id={`payroll-head-${configuration.id}-${row.key}`}
                    name="payroll_head_id"
                    options={options}
                    placeholder="Search payroll head"
                    value={row.payrollHeadId}
                    disabled={isCtc}
                    required
                    onChange={(payrollHeadId) => updateRow(row.key, { payrollHeadId, valueExpression: payrollHeadId === heads.find((head) => head.code === "CTC")?.id ? "" : row.valueExpression })}
                  />
                </td>
                <td>
                  {isCtc
                    ? <><input name="value_expression" type="hidden" value="" /><span className="custom-value-label">Custom input</span><small>Entered for each employee.</small></>
                    : <input aria-label={`${selectedHead?.name ?? "Payroll head"} value`} className="formula-input" name="value_expression" value={row.valueExpression} onChange={(event) => updateRow(row.key, { valueExpression: event.target.value })} placeholder="Example: CTC * 50%" />}
                </td>
                <td><input aria-label={`${selectedHead?.name ?? "Payroll head"} minimum value`} name="minimum_value" type="number" min="0" step="0.01" value={row.minimumValue} onChange={(event) => updateRow(row.key, { minimumValue: event.target.value })} placeholder="Optional" /></td>
                <td><input aria-label={`${selectedHead?.name ?? "Payroll head"} maximum value`} name="maximum_value" type="number" min="0" step="0.01" value={row.maximumValue} onChange={(event) => updateRow(row.key, { maximumValue: event.target.value })} placeholder="Optional" /></td>
                <td>{isCtc ? <span className="locked-label">Protected</span> : <button aria-label={`Remove ${selectedHead?.name ?? "payroll head"} row`} className="icon-button danger" type="button" onClick={() => removeRow(row.key)}><Trash2 size={15} /></button>}</td>
              </tr>;
            })}
            {!rows.length ? <tr><td className="empty-cell" colSpan={5}>Add a payroll head to configure this salary structure.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="salary-definition-actions">
        <p>Equations may reference the code of another selected payroll head, for example <code>CTC * 50%</code>.</p>
        <SubmitButton className="button primary" pendingLabel="Saving salary configuration…">Save</SubmitButton>
      </div>
    </form>
  </details>;
}
