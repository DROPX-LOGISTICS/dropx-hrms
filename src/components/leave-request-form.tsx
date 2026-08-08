"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { FormFeedback } from "@/components/form-feedback";
import { SubmitButton } from "@/components/submit-button";
import { requestLeave } from "@/app/(hrms)/leave/actions";
import type { EmployeeOption, LeaveTypeRow } from "@/lib/data";
import { initialActionFeedback } from "@/lib/action-feedback";

export function LeaveRequestForm({
  employees,
  types
}: {
  employees: EmployeeOption[];
  types: LeaveTypeRow[];
}) {
  const [state, formAction] = useFormState(requestLeave, initialActionFeedback);

  return (
    <section className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-head">
        <h2>New leave request</h2>
        <Link className="button secondary small" href="/leave">Close</Link>
      </div>
      <div className="panel-body">
        <form action={formAction}>
          <FormFeedback state={state} />
          <div className="form-grid">
            <div className="field wide">
              <label htmlFor="employee_id">Employee *</label>
              <select id="employee_id" name="employee_id" required>
                <option value="">Select employee</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} · {employee.employee_code ?? "No ID"}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="leave_type_id">Leave type *</label>
              <select id="leave_type_id" name="leave_type_id" required>
                <option value="">Select leave type</option>
                {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="start_date">Start date *</label>
              <input id="start_date" name="start_date" type="date" required />
            </div>
            <div className="field">
              <label htmlFor="end_date">End date *</label>
              <input id="end_date" name="end_date" type="date" required />
            </div>
            <div className="field wide">
              <label htmlFor="reason">Reason *</label>
              <textarea id="reason" name="reason" required />
            </div>
          </div>
          <div className="form-actions">
            <Link className="button secondary" href="/leave">Cancel</Link>
            <SubmitButton className="button primary" pendingLabel="Submitting request…">Submit request</SubmitButton>
          </div>
        </form>
      </div>
    </section>
  );
}
