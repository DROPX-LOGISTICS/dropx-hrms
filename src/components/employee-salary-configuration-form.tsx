"use client";

import { useMemo, useState } from "react";
import { SearchableSelect } from "@/components/searchable-select";
import { SubmitButton } from "@/components/submit-button";
import {
  calculateEmployeeSalary,
  EmployeeSalaryHead,
  reconcileEmployeeSalary,
  roundMoney,
  SalaryLimitAdjustment
} from "@/lib/employee-salary-calculator";
import { EmployeeSalaryAssignment } from "@/lib/employee-salary";
import { PayrollHeadType, SalaryConfigurationRow } from "@/lib/payroll";

const typeLabel: Record<PayrollHeadType, string> = {
  ctc: "System CTC",
  employee_earning: "Employee Earning",
  employee_deduction: "Employee Deduction",
  statutory_deduction: "Statutory Deduction",
  statutory_contribution: "Statutory Contribution"
};

type AmountPair = { monthly: string; yearly: string };

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value);
}

function amountText(value: number) {
  return roundMoney(value).toFixed(2);
}

function numericAmount(value: string) {
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function limitText(minimum: number | null, maximum: number | null) {
  if (minimum !== null && maximum !== null) return `${money(minimum)} to ${money(maximum)} monthly`;
  if (minimum !== null) return `Minimum ${money(minimum)} monthly`;
  if (maximum !== null) return `Maximum ${money(maximum)} monthly`;
  return "No configured limit";
}

function latestDate(...values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? "";
}

function configurationHeads(configuration: SalaryConfigurationRow | undefined): EmployeeSalaryHead[] {
  return (configuration?.hr_salary_configuration_items ?? [])
    .filter((item) => item.is_enabled && item.hr_payroll_heads)
    .map((item) => ({
      payrollHeadId: item.payroll_head_id,
      payrollHeadName: item.hr_payroll_heads!.name,
      payrollHeadCode: item.hr_payroll_heads!.code,
      headType: item.hr_payroll_heads!.head_type,
      calculationType: item.calculation_type,
      formula: item.value_expression ?? item.formula,
      fixedAmount: item.fixed_amount,
      minimumValue: item.minimum_value,
      maximumValue: item.maximum_value
    }));
}

function assignmentAmounts(
  configurationId: string,
  assignment: EmployeeSalaryAssignment | null,
  annualisationFactor: number
) {
  if (assignment?.configuration_id !== configurationId) return {};
  return Object.fromEntries(assignment.hr_employee_salary_values.map((value) => [
    value.payroll_head_id,
    {
      monthly: amountText(value.amount),
      yearly: amountText(value.amount * annualisationFactor)
    }
  ]));
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
  const annualisationFactor = Number(configuration?.annualisation_factor) || 12;
  const heads = useMemo(() => configurationHeads(configuration), [configuration]);
  const [effectiveFrom, setEffectiveFrom] = useState(
    assignment?.effective_from
      ?? latestDate(employeeDateOfJoin, configurations.find((item) => item.id === initialConfigurationId)?.effective_from)
  );
  const [amounts, setAmounts] = useState<Record<string, AmountPair>>(() => assignmentAmounts(
    initialConfigurationId,
    assignment,
    Number(configurations.find((item) => item.id === initialConfigurationId)?.annualisation_factor) || 12
  ));
  const [hasCalculated, setHasCalculated] = useState(Boolean(assignment));
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<SalaryLimitAdjustment[]>([]);

  const selectableConfigurations = configurations
    .filter((item) => item.is_active || item.id === assignment?.configuration_id)
    .map((item) => ({
      value: item.id,
      label: `${item.code} · ${item.name}${item.is_active ? "" : " · Inactive"}`
    }));

  const enteredValues = useMemo(() => {
    const values: Record<string, number> = {};
    for (const head of heads) {
      const amount = numericAmount(amounts[head.payrollHeadId]?.monthly ?? "");
      if (amount === null) return null;
      values[head.payrollHeadId] = amount;
    }
    return values;
  }, [amounts, heads]);

  const validationError = useMemo(() => {
    if (!hasCalculated) return null;
    if (!enteredValues) return "Enter a valid monthly or yearly value for every payroll head.";
    for (const head of heads) {
      const value = enteredValues[head.payrollHeadId];
      if (head.minimumValue !== null && value < head.minimumValue) {
        return `${head.payrollHeadName} cannot be lower than ${money(head.minimumValue)} monthly.`;
      }
      if (head.maximumValue !== null && value > head.maximumValue) {
        return `${head.payrollHeadName} cannot be higher than ${money(head.maximumValue)} monthly.`;
      }
    }
    return reconcileEmployeeSalary(heads, enteredValues).message;
  }, [enteredValues, hasCalculated, heads]);

  function setPeriodAmount(headId: string, period: keyof AmountPair, rawValue: string) {
    setAmounts((current) => {
      const next = { ...(current[headId] ?? { monthly: "", yearly: "" }), [period]: rawValue };
      const parsed = numericAmount(rawValue);
      if (parsed !== null) {
        if (period === "monthly") next.yearly = amountText(parsed * annualisationFactor);
        else next.monthly = amountText(parsed / annualisationFactor);
      } else if (!rawValue) {
        if (period === "monthly") next.yearly = "";
        else next.monthly = "";
      }
      return { ...current, [headId]: next };
    });
    setCalculationError(null);
  }

  function calculate() {
    try {
      const inputValues: Record<string, number> = {};
      for (const head of heads.filter((item) => item.calculationType === "input")) {
        const amount = numericAmount(amounts[head.payrollHeadId]?.monthly ?? "");
        if (amount === null) throw new Error(`Enter a valid Monthly CTC or Yearly CTC for ${head.payrollHeadName}.`);
        inputValues[head.payrollHeadId] = amount;
      }
      const result = calculateEmployeeSalary(heads, inputValues);
      setAmounts(Object.fromEntries(heads.map((head) => {
        const monthly = result.values[head.payrollHeadId];
        return [head.payrollHeadId, {
          monthly: amountText(monthly),
          yearly: amountText(monthly * annualisationFactor)
        }];
      })));
      setAdjustments(result.adjustments);
      setCalculationError(result.reconciliation.message);
      setHasCalculated(true);
    } catch (error) {
      setAdjustments([]);
      setCalculationError(error instanceof Error ? error.message : "The salary breakdown could not be calculated.");
      setHasCalculated(true);
    }
  }

  return <form action={action} className="employee-salary-form">
    <input name="employee_id" type="hidden" value={employeeId} />
    <div className="salary-assignment-heading">
      <div>
        <h3>Salary configuration</h3>
        <p>Enter monthly or yearly CTC, calculate the breakdown, then correct any flagged component before saving.</p>
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
            if (nextConfiguration) {
              setEffectiveFrom((current) => latestDate(current, nextConfiguration.effective_from));
              setAmounts(assignmentAmounts(
                nextConfigurationId,
                assignment,
                Number(nextConfiguration.annualisation_factor) || 12
              ));
              setHasCalculated(assignment?.configuration_id === nextConfigurationId);
            }
            setAdjustments([]);
            setCalculationError(null);
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

    {configuration ? <>
      <div className="salary-calculation-toolbar">
        <div>
          <strong>Salary amounts</strong>
          <p>Yearly values use a {annualisationFactor}-month annualisation factor. Editing either column updates the other.</p>
        </div>
        <button className="button secondary" type="button" onClick={calculate}>Calculate breakdown</button>
      </div>

      {adjustments.length > 0 && <div className="salary-adjustment-list" role="status">
        {adjustments.map((adjustment) => <p key={adjustment.payrollHeadId}>
          <strong>{adjustment.payrollHeadName}</strong> was changed from {money(adjustment.calculatedAmount)} to {money(adjustment.adjustedAmount)} because of its configured {adjustment.limit}.
        </p>)}
      </div>}
      {(calculationError || validationError) && <div className="alert error" role="alert">
        {validationError ?? calculationError}
      </div>}
      {hasCalculated && enteredValues && !validationError && !calculationError && <div className="alert success" role="status">
        CTC and its components are balanced. You can save this salary configuration.
      </div>}

      <div className="table-wrap employee-salary-table-wrap">
        <table className="employee-salary-table">
          <thead><tr><th>Payroll head</th><th>Pay type</th><th>Method and limits</th><th>Monthly value</th><th>Yearly value</th></tr></thead>
          <tbody>{heads.length ? heads.map((head) => {
            const item = configuration.hr_salary_configuration_items.find((row) => row.payroll_head_id === head.payrollHeadId)!;
            const pair = amounts[head.payrollHeadId] ?? { monthly: "", yearly: "" };
            return <tr key={item.id}>
              <td><strong>{head.payrollHeadName}</strong><div className="muted">{head.payrollHeadCode}</div></td>
              <td>{typeLabel[head.headType]}</td>
              <td>
                {head.calculationType === "input" ? <><strong>Custom</strong><div className="muted">{limitText(head.minimumValue, head.maximumValue)}</div></>
                  : head.calculationType === "fixed" ? <><strong>Constant</strong><div className="muted">{money(head.fixedAmount ?? 0)} · {limitText(head.minimumValue, head.maximumValue)}</div></>
                    : <><strong>Equation</strong><div className="muted"><code>{head.formula}</code></div><div className="muted">{limitText(head.minimumValue, head.maximumValue)}</div></>}
              </td>
              <td>
                <input name="salary_value_head_id" type="hidden" value={head.payrollHeadId} />
                <div className="money-input"><span>₹</span><input
                  aria-label={`${head.payrollHeadName} monthly value`}
                  name="salary_value_amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={pair.monthly}
                  onChange={(event) => setPeriodAmount(head.payrollHeadId, "monthly", event.target.value)}
                  required
                /></div>
              </td>
              <td><div className="money-input"><span>₹</span><input
                aria-label={`${head.payrollHeadName} yearly value`}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={pair.yearly}
                onChange={(event) => setPeriodAmount(head.payrollHeadId, "yearly", event.target.value)}
                required
              /></div></td>
            </tr>;
          }) : <tr><td className="empty-cell" colSpan={5}>This configuration has no payroll heads.</td></tr>}</tbody>
        </table>
      </div>
    </> : <div className="alert">Select a salary configuration to view its payroll heads.</div>}

    <div className="form-actions">
      <SubmitButton
        className="button primary"
        disabled={!configurationId || !configuration || heads.length === 0 || !hasCalculated || Boolean(validationError || calculationError)}
        pendingLabel="Saving salary configuration…"
      >
        Save salary configuration
      </SubmitButton>
    </div>
  </form>;
}
