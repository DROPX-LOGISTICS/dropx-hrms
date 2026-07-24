"use client";

import { useMemo, useState } from "react";
import { SearchableSelect } from "@/components/searchable-select";
import { SubmitButton } from "@/components/submit-button";
import { EmployeeSalaryAssignment } from "@/lib/employee-salary";
import { PayrollHeadType, SalaryConfigurationRow } from "@/lib/payroll";

const typeLabel: Record<PayrollHeadType, string> = {
  ctc: "System CTC",
  employee_earning: "Employee Earning",
  employee_deduction: "Employee Deduction",
  statutory_deduction: "Statutory Deduction",
  statutory_contribution: "Statutory Contribution"
};

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value);
}

function limitText(minimum: number | null, maximum: number | null) {
  if (minimum !== null && maximum !== null) return `${money(minimum)} to ${money(maximum)}`;
  if (minimum !== null) return `Minimum ${money(minimum)}`;
  if (maximum !== null) return `Maximum ${money(maximum)}`;
  return "No configured limit";
}

function latestDate(...values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? "";
}

export function EmployeeSalaryConfigurationForm({
  action,
  assignment,
  configurations,
  employeeId,
  employeeDateOfJoin
}: {
  action: (formData: FormData) => void | Promise<void>;
  assignment: EmployeeSalaryAssignment | null;
  configurations: SalaryConfigurationRow[];
  employeeId: string;
  employeeDateOfJoin: string;
}) {
  const initialConfigurationId = assignment?.configuration_id
    ?? configurations.find((configuration) => configuration.is_default && configuration.is_active)?.id
    ?? configurations.find((configuration) => configuration.is_active)?.id
    ?? "";
  const [configurationId, setConfigurationId] = useState(initialConfigurationId);
  const configuration = configurations.find((item) => item.id === configurationId);
  const [effectiveFrom, setEffectiveFrom] = useState(
    assignment?.effective_from
      ?? latestDate(employeeDateOfJoin, configurations.find((item) => item.id === initialConfigurationId)?.effective_from)
  );
  const currentValues = useMemo(
    () => new Map((assignment?.hr_employee_salary_values ?? []).map((value) => [value.payroll_head_id, value.amount])),
    [assignment]
  );
  const selectableConfigurations = configurations
    .filter((item) => item.is_active || item.id === assignment?.configuration_id)
    .map((item) => ({
      value: item.id,
      label: `${item.code} · ${item.name}${item.is_active ? "" : " · Inactive"}`
    }));
  const items = (configuration?.hr_salary_configuration_items ?? []).filter((item) => item.is_enabled);

  return <form action={action} className="employee-salary-form">
    <input name="employee_id" type="hidden" value={employeeId} />
    <div className="salary-assignment-heading">
      <div>
        <h3>Salary configuration</h3>
        <p>Assign the employee to a salary structure and enter values for its custom payroll heads.</p>
      </div>
      {assignment ? <span className="system-badge">Current assignment</span> : <span className="status-pill pending">Not assigned</span>}
    </div>
    <div className="master-entry-grid employee-salary-fields">
      <div className="field">
        <label htmlFor="employee_salary_configuration">Salary configuration *</label>
        <SearchableSelect
          id="employee_salary_configuration"
          name="configuration_id"
          options={selectableConfigurations}
          placeholder="Search salary configuration"
          value={configurationId}
          required
          onChange={(nextConfigurationId) => {
            setConfigurationId(nextConfigurationId);
            const nextConfiguration = configurations.find((item) => item.id === nextConfigurationId);
            if (nextConfiguration) setEffectiveFrom((current) => latestDate(current, nextConfiguration.effective_from));
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="employee_salary_effective_from">Effective from *</label>
        <input
          id="employee_salary_effective_from"
          name="effective_from"
          type="date"
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
          required
        />
        <small>A later effective date creates salary history automatically.</small>
      </div>
    </div>

    {configuration ? <div className="table-wrap employee-salary-table-wrap">
      <table className="employee-salary-table">
        <thead><tr><th>Payroll head</th><th>Pay type</th><th>Configuration method</th><th>Employee value</th></tr></thead>
        <tbody>{items.length ? items.map((item) => {
          const head = item.hr_payroll_heads;
          if (!head) return null;
          const isInput = item.calculation_type === "input";
          const value = assignment?.configuration_id === configuration.id ? currentValues.get(head.id) : undefined;
          return <tr key={item.id}>
            <td><strong>{head.name}</strong><div className="muted">{head.code}</div></td>
            <td>{typeLabel[head.head_type]}</td>
            <td>
              {isInput ? <><strong>Custom</strong><div className="muted">{limitText(item.minimum_value, item.maximum_value)}</div></>
                : item.calculation_type === "fixed" ? <><strong>Constant</strong><div className="muted">{money(item.fixed_amount ?? 0)}</div></>
                  : <><strong>Equation</strong><div className="muted"><code>{item.value_expression ?? item.formula}</code></div></>}
            </td>
            <td>{isInput ? <>
              <input name="salary_value_head_id" type="hidden" value={head.id} />
              <div className="money-input"><span>₹</span><input
                aria-label={`${head.name} employee value`}
                name="salary_value_amount"
                type="number"
                inputMode="decimal"
                min={item.minimum_value ?? 0}
                max={item.maximum_value ?? undefined}
                step="0.01"
                defaultValue={value ?? ""}
                required
              /></div>
            </> : <span className="locked-label">From configuration</span>}</td>
          </tr>;
        }) : <tr><td className="empty-cell" colSpan={4}>This configuration has no payroll heads.</td></tr>}</tbody>
      </table>
    </div> : <div className="alert">Select a salary configuration to view its payroll heads.</div>}

    <div className="form-actions">
      <SubmitButton
        className="button primary"
        disabled={!configurationId || !configuration || items.length === 0}
        pendingLabel="Saving salary configuration…"
      >
        Save salary configuration
      </SubmitButton>
    </div>
  </form>;
}
