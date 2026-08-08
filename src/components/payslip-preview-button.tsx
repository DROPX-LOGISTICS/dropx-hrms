"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type PayslipItem = {
  id: string;
  component_name: string;
  component_type: "earning" | "deduction" | "employer_contribution";
  amount: number;
};

type PayslipPreviewButtonProps = {
  companyName: string;
  runId: string;
  lineId: string;
  runStatus: string;
  periodMonth: string;
  payee: {
    fullName: string;
    code: string | null;
    designation: string | null;
    bankAccountNo: string | null;
    ifsc: string | null;
  };
  line: {
    status: string;
    pay_type: "monthly" | "package";
    working_days: number;
    present_days: number;
    paid_leave_days: number;
    lop_days: number;
    gross_earnings: number;
    total_deductions: number;
    net_pay: number;
    items: PayslipItem[];
  };
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function periodLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function PayslipPreviewButton({
  companyName,
  runId,
  lineId,
  runStatus,
  periodMonth,
  payee,
  line
}: PayslipPreviewButtonProps) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const canDownload = runStatus !== "draft" && line.status === "calculated";
  const hasBreakdown = line.status === "calculated";
  const earnings = line.items.filter((item) => item.component_type === "earning");
  const deductions = line.items.filter((item) => item.component_type === "deduction");
  const employerItems = line.items.filter((item) => item.component_type === "employer_contribution");
  const warning = runStatus === "draft"
    ? "Calculate the payroll run before generating payslips. Preview below shows the current breakup only."
    : line.status !== "calculated"
      ? "This member has not been calculated yet. Run Calculate on the payroll run first."
      : null;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return <>
    <button
      className={`button secondary small${!canDownload ? " payslip-button-blocked" : ""}`}
      type="button"
      aria-haspopup="dialog"
      title={!canDownload ? "Payslip not ready — click for details" : "Preview payslip"}
      onClick={() => setOpen(true)}
    >Payslip</button>
    {open ? createPortal(
      <div
        className="modal-backdrop payslip-modal-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <div className="payslip-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <div className="payslip-modal-head">
            <div>
              <h3 id={titleId}>Payslip preview</h3>
              <p className="panel-subtitle">{periodLabel(periodMonth)} · {payee.fullName}</p>
            </div>
            <button ref={closeRef} className="modal-close-button" type="button" aria-label="Close payslip preview" onClick={() => setOpen(false)}>×</button>
          </div>

          {warning ? <div className="alert error" role="alert">{warning}</div> : null}

          <div className="payslip-sheet" aria-hidden={!hasBreakdown}>
            <div className="payslip-sheet-bar" />
            <div className="payslip-sheet-brand">{companyName}</div>
            <div className="payslip-sheet-meta">
              <strong>PAYSLIP</strong>
              <span>{periodLabel(periodMonth)}</span>
            </div>

            <div className="payslip-sheet-info">
              <div>
                <div><span>Employee / Payee</span><strong>{payee.fullName}</strong></div>
                <div><span>Code</span><strong>{payee.code ?? "—"}</strong></div>
                <div><span>Designation</span><strong>{payee.designation ?? "—"}</strong></div>
              </div>
              <div>
                <div><span>Pay type</span><strong>{line.pay_type === "monthly" ? "Monthly salary" : "Job / package pay"}</strong></div>
                <div><span>Bank account</span><strong>{payee.bankAccountNo ?? "—"}</strong></div>
                <div><span>IFSC</span><strong>{payee.ifsc ?? "—"}</strong></div>
              </div>
            </div>

            {line.pay_type === "monthly" ? <div className="payslip-attendance">
              <div><span>Working days</span><strong>{line.working_days}</strong></div>
              <div><span>Present days</span><strong>{line.present_days}</strong></div>
              <div><span>Paid leave</span><strong>{line.paid_leave_days}</strong></div>
              <div><span>LOP days</span><strong>{line.lop_days}</strong></div>
            </div> : null}

            {hasBreakdown ? <>
              <div className="payslip-columns">
                <div>
                  <h4>Earnings</h4>
                  {earnings.length ? earnings.map((item) => (
                    <div key={item.id} className="payslip-row"><span>{item.component_name}</span><span>{money.format(item.amount)}</span></div>
                  )) : <p className="muted">No earnings recorded.</p>}
                  <div className="payslip-row payslip-row-total"><span>Gross earnings</span><span>{money.format(line.gross_earnings)}</span></div>
                </div>
                <div>
                  <h4>Deductions</h4>
                  {deductions.length ? deductions.map((item) => (
                    <div key={item.id} className="payslip-row"><span>{item.component_name}</span><span>{money.format(item.amount)}</span></div>
                  )) : <p className="muted">No deductions.</p>}
                  <div className="payslip-row payslip-row-total"><span>Total deductions</span><span>{money.format(line.total_deductions)}</span></div>
                </div>
              </div>

              {employerItems.length ? <div className="payslip-employer">
                <h4>Employer contributions (not part of net pay)</h4>
                {employerItems.map((item) => (
                  <div key={item.id} className="payslip-row"><span>{item.component_name}</span><span>{money.format(item.amount)}</span></div>
                ))}
              </div> : null}

              <div className="payslip-net">
                <span>Net pay</span>
                <strong>{money.format(line.net_pay)}</strong>
              </div>
            </> : <p className="muted" style={{ marginTop: 16 }}>No salary breakup to preview yet.</p>}

            <p className="payslip-footer">System-generated payslip from DropX HRMS. Contact HR for any discrepancy.</p>
          </div>

          <div className="form-actions payslip-modal-actions">
            <button className="button secondary" type="button" onClick={() => setOpen(false)}>Close</button>
            {canDownload ? (
              <a className="button primary" href={`/payroll/${runId}/payslip/${lineId}`} target="_blank" rel="noopener noreferrer">Download PDF</a>
            ) : (
              <button
                className="button primary payslip-button-blocked"
                type="button"
                aria-disabled="true"
                title={warning ?? "Payslip not ready"}
                onClick={(event) => event.preventDefault()}
              >Download PDF</button>
            )}
          </div>
        </div>
      </div>,
      document.body
    ) : null}
  </>;
}
