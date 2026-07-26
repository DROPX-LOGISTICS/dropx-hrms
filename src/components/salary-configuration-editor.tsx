"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { createPortal } from "react-dom";
import { EllipsisVertical, Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import { createSalaryConfiguration, saveSalaryConfiguration } from "@/app/settings/salary/actions";
import { SearchableSelect } from "@/components/searchable-select";
import { SubmitButton } from "@/components/submit-button";
import {
  buildPayrollValueExpression,
  payrollValueMethodState
} from "@/lib/payroll-configuration";
import type { PayrollValueMethod } from "@/lib/payroll-configuration";
import type { PayrollHeadRow, SalaryConfigurationRow } from "@/lib/payroll";

type EditorRow = {
  key: string;
  headType: PayrollHeadRow["head_type"];
  payrollHeadId: string;
  method: PayrollValueMethod;
  fixedValue: string;
  percentageBaseCode: string;
  percentage: string;
  advancedFormula: string;
  minimumValue: string;
  maximumValue: string;
};

type ModalSelection = {
  configuration: SalaryConfigurationRow;
  mode: "view" | "edit";
  instance: number;
};

const typeLabel: Record<PayrollHeadRow["head_type"], string> = {
  ctc: "System CTC",
  employee_earning: "Employee Earning",
  employee_deduction: "Employee Deduction",
  statutory_deduction: "Statutory Deduction",
  statutory_contribution: "Statutory Contribution"
};

type ComponentHeadType = Exclude<PayrollHeadRow["head_type"], "ctc">;

const componentGroups: Array<{
  headType: ComponentHeadType;
  title: string;
  description: string;
}> = [
  { headType: "employee_earning", title: "Employee Earnings", description: "Salary and allowance components paid to the employee." },
  { headType: "employee_deduction", title: "Employee Deductions", description: "Company-defined amounts deducted from the employee." },
  { headType: "statutory_contribution", title: "Statutory Contributions", description: "Employer statutory contributions included in CTC." },
  { headType: "statutory_deduction", title: "Statutory Deductions", description: "Employee statutory deductions included in the salary structure." }
];

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
    headType: "ctc",
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

function emptyRow(key: string, heads: PayrollHeadRow[], headType: ComponentHeadType): EditorRow {
  return {
    key,
    headType,
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
      headType: heads.find((head) => head.id === item.payroll_head_id)?.head_type ?? "employee_earning",
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

function SalaryComponentGroupRows({
  allRows,
  description,
  headType,
  heads,
  idPrefix,
  rows,
  setRows,
  title,
  readOnly = false
}: {
  allRows: EditorRow[];
  description: string;
  headType: PayrollHeadRow["head_type"];
  heads: PayrollHeadRow[];
  idPrefix: string;
  rows: EditorRow[];
  setRows: Dispatch<SetStateAction<EditorRow[]>>;
  title: string;
  readOnly?: boolean;
}) {
  const rowSequence = useRef(0);
  const selectedIds = new Set(rows.map((row) => row.payrollHeadId).filter(Boolean));
  const canAdd = headType !== "ctc" && heads.some((head) =>
    head.head_type === headType && head.is_active && !selectedIds.has(head.id)
  );

  function updateRow(key: string, values: Partial<EditorRow>) {
    if (readOnly) return;
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...values } : row));
  }

  function addRow() {
    if (headType === "ctc") return;
    rowSequence.current += 1;
    setRows((current) => [...current, emptyRow(`new-${Date.now()}-${rowSequence.current}`, heads, headType)]);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return <>
    <div className="salary-definition-toolbar">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {!readOnly && headType !== "ctc" ? <button className="button secondary small" type="button" onClick={addRow} disabled={!canAdd}><Plus size={14} /> Add {typeLabel[headType].toLowerCase()}</button> : null}
    </div>
    <div className="table-wrap salary-component-table-wrap">
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
          {rows.length ? rows.map((row) => {
            const selectedHead = heads.find((head) => head.id === row.payrollHeadId);
            const isCtc = selectedHead?.code === "CTC";
            const expression = expressionForRow(row);
            const headOptions = heads
              .filter((head) => head.head_type === headType)
              .filter((head) => (head.is_active || head.id === row.payrollHeadId) && (!selectedIds.has(head.id) || head.id === row.payrollHeadId))
              .map((head) => ({ value: head.id, label: `${head.name} · ${head.code} · ${typeLabel[head.head_type]}${head.is_active ? "" : " · Inactive"}` }));
            const selectedRowHeads = allRows
              .map((candidate) => heads.find((head) => head.id === candidate.payrollHeadId))
              .filter((head): head is PayrollHeadRow => Boolean(head && head.id !== row.payrollHeadId));
            const baseOptions = selectedRowHeads.map((head) => ({ value: head.code, label: `${head.name} · ${head.code}` }));

            return <tr key={row.key}>
              <td data-label="Payroll component">
                <input name="payroll_head_type" type="hidden" value={row.headType} />
                <SearchableSelect
                  id={`${idPrefix}-payroll-head-${row.key}`}
                  name="payroll_head_id"
                  options={headOptions}
                  placeholder="Search component"
                  value={row.payrollHeadId}
                  disabled={readOnly || isCtc}
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
              <td data-label="Calculation method">
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
                  disabled={readOnly}
                  required
                  onChange={(method) => updateRow(row.key, { method: method as PayrollValueMethod })}
                />}
              </td>
              <td data-label="Value setup">
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
                  disabled={readOnly}
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
                      disabled={readOnly}
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
                      disabled={readOnly}
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
                    disabled={readOnly}
                    onChange={(event) => updateRow(row.key, { advancedFormula: event.target.value })}
                    placeholder="Example: (CTC - HRA) / 2"
                    required
                  />
                  {!readOnly ? <div className="formula-token-list"><span>Insert:</span>{selectedRowHeads.map((head) => <button key={head.id} type="button" onClick={() => updateRow(row.key, { advancedFormula: `${row.advancedFormula}${row.advancedFormula ? " " : ""}[${head.code}]` })}>{head.code}</button>)}</div> : null}
                </div>}
              </td>
              <td data-label="Minimum">{isCtc ? <><input name="minimum_value" type="hidden" value="" /><span className="not-applicable-label">Not applicable</span></> : <input aria-label={`${selectedHead?.name ?? "Component"} minimum value`} name="minimum_value" type="number" min="0" step="0.01" value={row.minimumValue} disabled={readOnly} onChange={(event) => updateRow(row.key, { minimumValue: event.target.value })} placeholder="Optional" />}</td>
              <td data-label="Maximum">{isCtc ? <><input name="maximum_value" type="hidden" value="" /><span className="not-applicable-label">Not applicable</span></> : <input aria-label={`${selectedHead?.name ?? "Component"} maximum value`} name="maximum_value" type="number" min="0" step="0.01" value={row.maximumValue} disabled={readOnly} onChange={(event) => updateRow(row.key, { maximumValue: event.target.value })} placeholder="Optional" />}</td>
              <td data-label="Action">{isCtc ? <span className="locked-label">Protected</span> : readOnly ? <span className="not-applicable-label">—</span> : <button aria-label={`Remove ${selectedHead?.name ?? "component"} row`} className="icon-button danger" type="button" onClick={() => removeRow(row.key)}><Trash2 size={15} /></button>}</td>
            </tr>;
          }) : <tr><td className="empty-cell" colSpan={6}>No {title.toLowerCase()} added.</td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}

function SalaryComponentRows({
  heads,
  idPrefix,
  rows,
  setRows,
  readOnly = false
}: {
  heads: PayrollHeadRow[];
  idPrefix: string;
  rows: EditorRow[];
  setRows: Dispatch<SetStateAction<EditorRow[]>>;
  readOnly?: boolean;
}) {
  return <div className="salary-component-groups">
    <section className="salary-component-group salary-component-group-ctc">
      <SalaryComponentGroupRows
        allRows={rows}
        description="Protected Cost to Company entered as a monthly or yearly value on the employee profile."
        headType="ctc"
        heads={heads}
        idPrefix={`${idPrefix}-ctc`}
        rows={rows.filter((row) => row.headType === "ctc")}
        setRows={setRows}
        title="CTC"
        readOnly={readOnly}
      />
    </section>
    {componentGroups.map((group) => <section className="salary-component-group" key={group.headType}>
      <SalaryComponentGroupRows
        allRows={rows}
        description={readOnly
          ? group.description
          : `${group.description} The dropdown shows only ${group.title.toLowerCase()} payroll heads.`}
        headType={group.headType}
        heads={heads}
        idPrefix={`${idPrefix}-${group.headType}`}
        rows={rows.filter((row) => row.headType === group.headType)}
        setRows={setRows}
        title={group.title}
        readOnly={readOnly}
      />
    </section>)}
  </div>;
}

export function CreateSalaryConfigurationEditor({ heads }: { heads: PayrollHeadRow[] }) {
  const [rows, setRows] = useState<EditorRow[]>(() => [ctcRow(heads)]);
  return <form action={createSalaryConfiguration} className="salary-create-form">
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

function SalaryConfigurationActionsMenu({
  configuration,
  onSelect
}: {
  configuration: SalaryConfigurationRow;
  onSelect: (mode: "view" | "edit") => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node) && !popoverRef.current?.contains(event.target as Node)) setOpen(false);
    }
    const closeOnViewportChange = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, []);

  function toggleMenu() {
    if (open) return setOpen(false);
    const bounds = rootRef.current?.getBoundingClientRect();
    if (bounds) {
      const menuHeight = 82;
      const top = bounds.bottom + menuHeight + 8 <= window.innerHeight
        ? bounds.bottom + 5
        : Math.max(8, bounds.top - menuHeight - 5);
      setPosition({ top, right: window.innerWidth - bounds.right });
    }
    setOpen(true);
  }

  function select(mode: "view" | "edit") {
    setOpen(false);
    onSelect(mode);
  }

  return <div className="row-actions-menu" ref={rootRef}>
    <button
      className="row-actions-trigger"
      type="button"
      aria-label={`Actions for ${configuration.name}`}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={toggleMenu}
    >
      <EllipsisVertical size={18} />
    </button>
    {open ? createPortal(
      <div
        className="row-actions-popover"
        ref={popoverRef}
        role="menu"
        aria-label={`Actions for ${configuration.name}`}
        style={{ top: position.top, right: position.right }}
      >
        <button role="menuitem" type="button" onClick={() => select("view")}><Eye size={15} />View</button>
        <button role="menuitem" type="button" onClick={() => select("edit")}><Pencil size={15} />Edit</button>
      </div>,
      document.body
    ) : null}
  </div>;
}

function SalaryConfigurationModal({
  configuration,
  heads,
  mode,
  onClose
}: {
  configuration: SalaryConfigurationRow;
  heads: PayrollHeadRow[];
  mode: "view" | "edit";
  onClose: () => void;
}) {
  const [rows, setRows] = useState<EditorRow[]>(() => initialRows(configuration, heads));
  const readOnly = mode === "view";
  const titleId = `salary-configuration-${mode}-title`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop salary-config-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="salary-config-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="salary-config-modal-head">
          <div>
            <p className="eyebrow">Salary configuration</p>
            <h2 id={titleId}>{readOnly ? "View" : "Edit"} {configuration.name}</h2>
            <p>{readOnly ? "Review configuration details and calculation rules." : "Update the name, components and calculation rules."}</p>
          </div>
          <button className="modal-close-button" type="button" aria-label="Close salary configuration" onClick={onClose}><X size={19} /></button>
        </div>
        <form action={readOnly ? undefined : saveSalaryConfiguration} onSubmit={readOnly ? (event) => event.preventDefault() : undefined}>
          <div className="salary-config-modal-body">
            <input name="configuration_id" type="hidden" value={configuration.id} />
            <div className="master-entry-grid salary-config-details salary-config-modal-details">
              <div className="field">
                <label htmlFor={`${configuration.id}-${mode}-code`}>Configuration code</label>
                <input id={`${configuration.id}-${mode}-code`} value={configuration.code} disabled />
                <small>Permanent reference code.</small>
              </div>
              <div className="field">
                <label htmlFor={`${configuration.id}-${mode}-name`}>Configuration name *</label>
                <input id={`${configuration.id}-${mode}-name`} name="configuration_name" defaultValue={configuration.name} disabled={readOnly} required />
              </div>
            </div>
            <SalaryComponentRows heads={heads} idPrefix={`${configuration.id}-${mode}`} rows={rows} setRows={setRows} readOnly={readOnly} />
          </div>
          <div className="salary-config-modal-actions">
            <button className="button secondary" type="button" onClick={onClose}>{readOnly ? "Close" : "Cancel"}</button>
            {!readOnly ? <SubmitButton className="button primary" pendingLabel="Saving salary configuration…">Save configuration</SubmitButton> : null}
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export function SalaryConfigurationList({
  configurations,
  heads
}: {
  configurations: SalaryConfigurationRow[];
  heads: PayrollHeadRow[];
}) {
  const [selection, setSelection] = useState<ModalSelection | null>(null);
  const modalSequence = useRef(0);

  function open(configuration: SalaryConfigurationRow, mode: "view" | "edit") {
    modalSequence.current += 1;
    setSelection({ configuration, mode, instance: modalSequence.current });
  }

  if (!configurations.length) return <div className="alert">No salary configuration exists. Create the first complete configuration above.</div>;

  return <>
    <div className="table-wrap salary-configuration-list-wrap">
      <table className="salary-configuration-list-table">
        <thead><tr><th>Name</th><th>Code</th><th>Components</th><th>Default</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          {configurations.map((configuration) => {
            const componentCount = configuration.hr_salary_configuration_items.length;
            return <tr key={configuration.id}>
              <td><strong>{configuration.name}</strong></td>
              <td><code>{configuration.code}</code></td>
              <td>{componentCount} {componentCount === 1 ? "component" : "components"}</td>
              <td>{configuration.is_default ? <span className="system-badge">Default</span> : <span className="muted-table-value">—</span>}</td>
              <td><span className={`status-pill ${configuration.is_active ? "active" : "inactive"}`}>{configuration.is_active ? "Active" : "Inactive"}</span></td>
              <td><SalaryConfigurationActionsMenu configuration={configuration} onSelect={(mode) => open(configuration, mode)} /></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    {selection ? <SalaryConfigurationModal
      key={`${selection.configuration.id}-${selection.mode}-${selection.instance}`}
      configuration={selection.configuration}
      heads={heads}
      mode={selection.mode}
      onClose={() => setSelection(null)}
    /> : null}
  </>;
}
