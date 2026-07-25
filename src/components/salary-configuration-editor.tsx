"use client";

import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createSalaryConfiguration, saveSalaryConfiguration } from "@/app/settings/salary/actions";
import { SearchableSelect } from "@/components/searchable-select";
import { SubmitButton } from "@/components/submit-button";
import {
  buildPayrollValueExpression,
  PayrollValueMethod,
  payrollValueMethodState
} from "@/lib/payroll-configuration";
import { PayrollHeadRow, SalaryConfigurationRow } from "@/lib/payroll";

type EditorRow = {
  key: string;
  payrollHeadId: string;
  method: PayrollValueMethod;
  fixedValue: string;
  percentageBaseCode: string;
  percentage: string;
  advancedFormula: string;
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

const methodOptions = [
  { value: "input", label: "Employee-specific amount" },
  { value: "fixed", label: "Fixed amount" },
  { value: "percentage", label: "Percentage of another component" },
  { value: "advanced", label: "Advanced equation" }
];

function ctcRow(heads: PayrollHeadRow[], key = "protected-ctc"): EditorRow {
  const ctc = heads.find((head) => head.code === "CTC");
  return {
    key,
    payrollHeadId: ctc?.id ?? "",
    method: "input",
    fixedValue: "",
    percentageBaseCode: "",
    percentage: "",
    advancedFormula: "",
    minimumValue: "",
    maximumValue: ""
  };
}

function emptyRow(key: string, heads: PayrollHeadRow[]): EditorRow {
  return {
    key,
    payrollHeadId: "",
    method: "percentage",
    fixedValue: "",
    percentageBaseCode: heads.find((head) => head.code === "CTC")?.code ?? "",
    percentage: "",
    advancedFormula: "",
    minimumValue: "",
    maximumValue: ""
  };
}

function initialRows(configuration: SalaryConfigurationRow, heads: PayrollHeadRow[]): EditorRow[] {
  const rows = configuration.hr_salary_configuration_items.map((item) => {
    const expression = item.value_expression ?? item.formula ?? (item.fixed_amount === null ? "" : String(item.fixed_amount));
    const methodState = payrollValueMethodState(expression);
    return {
      key: item.id,
      payrollHeadId: item.payroll_head_id,
      ...methodState,
      minimumValue: item.minimum_value === null ? "" : String(item.minimum_value),
      maximumValue: item.maximum_value === null ? "" : String(item.maximum_value)
    };
  });
  if (!rows.some((row) => heads.find((head) => head.id === row.payrollHeadId)?.code === "CTC")) rows.unshift(ctcRow(heads));
  return rows;
}

function expressionForRow(row: EditorRow) {
  return buildPayrollValueExpression({
    method: row.method,
    fixedValue: row.fixedValue,
    percentageBaseCode: row.percentageBaseCode,
    percentage: row.percentage,
    advancedFormula: row.advancedFormula
  });
}

function SalaryComponentRows({
  heads,
  idPrefix,
  rows,
  setRows
}: {
  heads: PayrollHeadRow[];
  idPrefix: string;
  rows: EditorRow[];
  setRows: Dispatch<SetStateAction<EditorRow[]>>;
}) {
  const rowSequence = useRef(0);
  const selectedIds = new Set(rows.map((row) => row.payrollHeadId).filter(Boolean));

  function updateRow(key: string, values: Partial<EditorRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...values } : row));
  }
  function addRow() {
    rowSequence.current += 1;
    setRows((current) => [...current, emptyRow(`new-${Date.now()}-${rowSequence.current}`, heads)]);
  }
  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return <>
    <div className="salary-definition-toolbar">
      <div><strong>Salary components</strong><p>Add each component, choose how it is calculated, and save the complete configuration once.</p></div>
      <button className="button secondary small" type="button" onClick={addRow}><Plus size={14} /> Add component</button>
    </div>
    <div className="table-wrap">
      <table className="salary-definition-table salary-builder-table">
        <thead><tr>
          <th>Payroll component</th>
          <th>Calculation method</th>
          <th>Value setup</th>
          <th>Minimum</th>
          <th>Maximum</th>
          <th>Action</th>
        </tr></thead>
        <tbody>
          {rows.map((row) => {
            const selectedHead = heads.find((head) => head.id === row.payrollHeadId);
            const isCtc = selectedHead?.code === "CTC";
            const expression = expressionForRow(row);
            const headOptions = heads
              .filter((head) => (head.is_active || head.id === row.payrollHeadId) && (!selectedIds.has(head.id) || head.id === row.payrollHeadId))
              .map((head) => ({ value: head.id, label: `${head.name} · ${head.code} · ${typeLabel[head.head_type]}${head.is_active ? "" : " · Inactive"}` }));
            const selectedRowHeads = rows
              .map((candidate) => heads.find((head) => head.id === candidate.payrollHeadId))
              .filter((head): head is PayrollHeadRow => Boolean(head && head.id !== row.payrollHeadId));
            const baseOptions = selectedRowHeads.map((head) => ({ value: head.code, label: `${head.name} · ${head.code}` }));

            return <tr key={row.key}>
              <td>
                <SearchableSelect
                  id={`${idPrefix}-payroll-head-${row.key}`}
                  name="payroll_head_id"
                  options={headOptions}
                  placeholder="Search component"
                  value={row.payrollHeadId}
                  disabled={isCtc}
                  required
                  onChange={(payrollHeadId) => {
                    const nextHead = heads.find((head) => head.id === payrollHeadId);
                    updateRow(row.key, {
                      payrollHeadId,
                      method: nextHead?.code === "CTC" ? "input" : row.method,
                      percentageBaseCode: nextHead?.code === row.percentageBaseCode ? "CTC" : row.percentageBaseCode
                    });
                  }}
                />
              </td>
              <td>
                {isCtc ? <>
                  <input name="value_method" type="hidden" value="input" />
                  <span className="custom-value-label">Employee input</span>
                  <small>Protected CTC value</small>
                </> : <SearchableSelect
                  id={`${idPrefix}-value-method-${row.key}`}
                  name="value_method"
                  options={methodOptions}
                  placeholder="Search calculation method"
                  value={row.method}
                  required
                  onChange={(method) => updateRow(row.key, { method: method as PayrollValueMethod })}
                />}
              </td>
              <td>
                {isCtc ? <>
                  <input name="value_expression" type="hidden" value="" />
                  <span className="salary-display-value">Entered on employee profile</span>
                </> : row.method === "input" ? <>
                  <input name="value_expression" type="hidden" value="" />
                  <span className="salary-display-value">Entered separately for each employee</span>
                </> : row.method === "fixed" ? <div className="money-input salary-method-input"><span>₹</span><input
                  aria-label={`${selectedHead?.name ?? "Component"} fixed amount`}
                  name="value_expression"
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.fixedValue}
                  onChange={(event) => updateRow(row.key, { fixedValue: event.target.value })}
                  placeholder="Amount"
                  required
                /></div> : row.method === "percentage" ? <div className="percentage-builder">
                  <input name="value_expression" type="hidden" value={expression} />
                  <div className="percentage-builder-controls">
                    <input
                      aria-label={`${selectedHead?.name ?? "Component"} percentage`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.percentage}
                      onChange={(event) => updateRow(row.key, { percentage: event.target.value })}
                      placeholder="%"
                      required
                    />
                    <span>% of</span>
                    <SearchableSelect
                      id={`${idPrefix}-percentage-base-${row.key}`}
                      name={`percentage_base_${row.key}`}
                      options={baseOptions}
                      placeholder="Search base component"
                      value={row.percentageBaseCode}
                      required
                      onChange={(percentageBaseCode) => updateRow(row.key, { percentageBaseCode })}
                    />
                  </div>
                  <small>{row.percentage && row.percentageBaseCode ? `${row.percentage}% of ${heads.find((head) => head.code === row.percentageBaseCode)?.name ?? row.percentageBaseCode}` : "Choose a percentage and base component."}</small>
                </div> : <div className="advanced-formula-builder">
                  <input
                    aria-label={`${selectedHead?.name ?? "Component"} advanced equation`}
                    className="formula-input"
                    name="value_expression"
                    value={row.advancedFormula}
                    onChange={(event) => updateRow(row.key, { advancedFormula: event.target.value })}
                    placeholder="Example: (CTC - HRA) / 2"
                    required
                  />
                  <div className="formula-token-list"><span>Insert:</span>{selectedRowHeads.map((head) => <button key={head.id} type="button" onClick={() => updateRow(row.key, { advancedFormula: `${row.advancedFormula}${row.advancedFormula ? " " : ""}[${head.code}]` })}>{head.code}</button>)}</div>
                </div>}
              </td>
              <td>{isCtc ? <><input name="minimum_value" type="hidden" value="" /><span className="not-applicable-label">Not applicable</span></> : <input aria-label={`${selectedHead?.name ?? "Component"} minimum value`} name="minimum_value" type="number" min="0" step="0.01" value={row.minimumValue} onChange={(event) => updateRow(row.key, { minimumValue: event.target.value })} placeholder="Optional" />}</td>
              <td>{isCtc ? <><input name="maximum_value" type="hidden" value="" /><span className="not-applicable-label">Not applicable</span></> : <input aria-label={`${selectedHead?.name ?? "Component"} maximum value`} name="maximum_value" type="number" min="0" step="0.01" value={row.maximumValue} onChange={(event) => updateRow(row.key, { maximumValue: event.target.value })} placeholder="Optional" />}</td>
              <td>{isCtc ? <span className="locked-label">Protected</span> : <button aria-label={`Remove ${selectedHead?.name ?? "component"} row`} className="icon-button danger" type="button" onClick={() => removeRow(row.key)}><Trash2 size={15} /></button>}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </>;
}

export function CreateSalaryConfigurationEditor({ heads }: { heads: PayrollHeadRow[] }) {
  const [rows, setRows] = useState<EditorRow[]>(() => [ctcRow(heads)]);
  return <form action={createSalaryConfiguration}>
    <div className="master-entry-grid salary-config-details">
      <div className="field"><label htmlFor="salary-configuration-code">Configuration code *</label><input id="salary-configuration-code" name="code" placeholder="MONTHLY_STAFF" required /><small>Permanent reference code.</small></div>
      <div className="field"><label htmlFor="salary-configuration-name">Configuration name *</label><input id="salary-configuration-name" name="name" placeholder="Monthly Staff Salary" required /></div>
    </div>
    <SalaryComponentRows heads={heads} idPrefix="new-configuration" rows={rows} setRows={setRows} />
    <div className="salary-definition-actions">
      <p>Tip: use “Percentage of another component” for common rules such as Basic Salary = 50% of CTC.</p>
      <SubmitButton className="button primary" pendingLabel="Creating salary configuration…">Create and save configuration</SubmitButton>
    </div>
  </form>;
}

export function SalaryConfigurationEditor({ configuration, heads }: { configuration: SalaryConfigurationRow; heads: PayrollHeadRow[] }) {
  const [rows, setRows] = useState<EditorRow[]>(() => initialRows(configuration, heads));
  return <details className="salary-config-card" open>
    <summary>
      <span><strong>{configuration.name}</strong><small>Configuration code: {configuration.code}</small></span>
      <span className="config-badges"><em className="active">{rows.length} payroll {rows.length === 1 ? "component" : "components"}</em></span>
    </summary>
    <form action={saveSalaryConfiguration}>
      <input name="configuration_id" type="hidden" value={configuration.id} />
      <SalaryComponentRows heads={heads} idPrefix={configuration.id} rows={rows} setRows={setRows} />
      <div className="salary-definition-actions">
        <p>Calculation methods are stored as validated payroll equations automatically.</p>
        <SubmitButton className="button primary" pendingLabel="Saving salary configuration…">Save configuration</SubmitButton>
      </div>
    </form>
  </details>;
}
