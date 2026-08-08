import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { PACKAGE_TYPE_LABELS, PACKAGE_TYPES } from "@/lib/package-types";
import { can } from "@/lib/permissions";
import {
  getEffectivePackageRates,
  getPayrollRunLine,
  getStationLabel,
  listPackageEntriesForLine,
  UNASSIGNED_STATION_ID
} from "@/lib/payroll-run";
import {
  addAdjustmentAction,
  saveMemberPackageEntriesAction,
  saveMemberPackageRatesAction,
  setLopOverrideAction
} from "../../../actions";

export const metadata: Metadata = { title: "Payroll member" };

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
function periodLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default async function PayrollMemberPage({
  params,
  searchParams
}: {
  params: { id: string; lineId: string };
  searchParams?: { error?: string; notice?: string };
}) {
  const auth = await requireHrmsAuth("payroll.view");
  const canProcess = can(auth.permissions, "payroll.process");
  const result = await getPayrollRunLine(auth, params.id, params.lineId);
  if (!result) notFound();
  const { run, line } = result;
  const stationId = line.location_id ?? UNASSIGNED_STATION_ID;
  const station = await getStationLabel(auth, stationId);
  const editable = canProcess && (run.status === "draft" || run.status === "calculated");
  const redirectTo = `/payroll/${run.id}/lines/${line.id}`;
  const items = line.hr_payroll_run_line_items ?? [];
  const earnings = items.filter((item) => item.component_type === "earning");
  const deductions = items.filter((item) => item.component_type === "deduction");
  const employerItems = items.filter((item) => item.component_type === "employer_contribution");

  const [entries, rates] = line.pay_type === "package"
    ? await Promise.all([
      listPackageEntriesForLine(auth, line.id),
      getEffectivePackageRates(auth, line.payee_type, line.payee_id)
    ])
    : [[], []];

  return <>
    <PageHeader
      eyebrow={periodLabel(run.period_month)}
      title={line.payee_name}
      description={`${line.payee_code ?? "No code"} · ${line.payee_type === "employee" ? "Employee" : "Contractor"} · ${line.pay_type === "monthly" ? "Monthly salary" : "Package pay"} · ${station?.stationName ?? "Unassigned"}`}
      action={<Link className="button secondary" href={`/payroll/${run.id}/stations/${stationId}`}><ArrowLeft size={15} /> Station</Link>}
    />
    {searchParams?.error ? <div className="alert error" role="alert">{searchParams.error}</div> : null}
    {searchParams?.notice ? <div className="alert success" role="status">{searchParams.notice}</div> : null}

    <section className="grid stats-grid">
      <article className="card stat"><span className="stat-label">Status</span><strong className="stat-value" style={{ fontSize: 18 }}><StatusPill value={line.status} /></strong></article>
      <article className="card stat"><span className="stat-label">Gross</span><strong className="stat-value" style={{ fontSize: 20 }}>{money.format(line.gross_earnings)}</strong></article>
      <article className="card stat"><span className="stat-label">Deductions</span><strong className="stat-value" style={{ fontSize: 20 }}>{money.format(line.total_deductions)}</strong></article>
      <article className="card stat"><span className="stat-label">Net pay</span><strong className="stat-value" style={{ fontSize: 20 }}>{money.format(line.net_pay)}</strong></article>
    </section>

    {line.notes ? <div className="alert error" role="alert">{line.notes}</div> : null}

    {line.pay_type === "monthly" ? <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head"><h2>Attendance summary</h2></div>
      <div className="panel-body">
        <div className="details-grid">
          <div className="detail"><dt>Working days</dt><dd>{line.working_days}</dd></div>
          <div className="detail"><dt>Present days</dt><dd>{line.present_days}</dd></div>
          <div className="detail"><dt>Paid leave</dt><dd>{line.paid_leave_days}</dd></div>
          <div className="detail"><dt>Loss of pay</dt><dd>{line.lop_days} {line.lop_manual_override ? "(manual)" : ""}</dd></div>
        </div>
      </div>
    </section> : null}

    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <div>
          <h2>Salary breakup</h2>
          <p className="panel-subtitle">Calculated components for this member.</p>
        </div>
        {line.status === "calculated" ? <a className="button secondary small" href={`/payroll/${run.id}/payslip/${line.id}`} target="_blank" rel="noopener noreferrer">Payslip</a> : null}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Component</th><th>Type</th><th>Amount</th></tr></thead>
          <tbody>
            {earnings.map((item) => <tr key={item.id}><td>{item.component_name}</td><td className="capitalize">Earning</td><td>{money.format(item.amount)}</td></tr>)}
            {deductions.map((item) => <tr key={item.id}><td>{item.component_name}</td><td className="capitalize">Deduction</td><td className="text-negative">-{money.format(item.amount)}</td></tr>)}
            {employerItems.map((item) => <tr key={item.id}><td>{item.component_name}</td><td className="capitalize">Employer contribution</td><td>{money.format(item.amount)}</td></tr>)}
            {!items.length ? <tr><td className="empty-cell" colSpan={3}>No components calculated yet.</td></tr> : null}
          </tbody>
          <tfoot>
            <tr><td colSpan={2}><strong>Gross earnings</strong></td><td><strong>{money.format(line.gross_earnings)}</strong></td></tr>
            <tr><td colSpan={2}><strong>Total deductions</strong></td><td><strong>-{money.format(line.total_deductions)}</strong></td></tr>
            <tr><td colSpan={2}><strong>Net pay</strong></td><td><strong>{money.format(line.net_pay)}</strong></td></tr>
            <tr><td colSpan={2}>Employer cost (contributions)</td><td>{money.format(line.employer_contributions)}</td></tr>
          </tfoot>
        </table>
      </div>
    </section>

    {editable && line.pay_type === "monthly" ? <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head"><h2>Edit monthly salary</h2></div>
      <div className="panel-body grid two-column">
        <form action={setLopOverrideAction} className="form-grid">
          <input type="hidden" name="run_id" value={run.id} />
          <input type="hidden" name="run_line_id" value={line.id} />
          <input type="hidden" name="redirect_to" value={redirectTo} />
          <div className="field"><label htmlFor="lop-days">Override loss of pay (days)</label><input id="lop-days" name="lop_days" type="number" min="0" step="0.5" defaultValue={line.lop_days} required /></div>
          <div style={{ alignSelf: "end" }}><SubmitButton className="button secondary" pendingLabel="Updating…">Update &amp; recalculate</SubmitButton></div>
        </form>
        <form action={addAdjustmentAction} className="form-grid">
          <input type="hidden" name="run_id" value={run.id} />
          <input type="hidden" name="run_line_id" value={line.id} />
          <input type="hidden" name="redirect_to" value={redirectTo} />
          <div className="field"><label htmlFor="adj-name">Add one-off adjustment</label><input id="adj-name" name="name" placeholder="e.g. Festival bonus" required /></div>
          <div className="field"><label htmlFor="adj-amount">Amount (₹)</label><input id="adj-amount" name="amount" type="number" min="0.01" step="0.01" required /></div>
          <div className="field"><label htmlFor="adj-type">Type</label><select id="adj-type" name="type" defaultValue="earning"><option value="earning">Earning (adds to net pay)</option><option value="deduction">Deduction (reduces net pay)</option><option value="employer_contribution">Employer contribution only</option></select></div>
          <div style={{ alignSelf: "end" }}><SubmitButton className="button secondary" pendingLabel="Adding…">Add adjustment</SubmitButton></div>
        </form>
      </div>
    </section> : null}

    {line.pay_type === "package" ? <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <div>
          <h2>Package counts</h2>
          <p className="panel-subtitle">Manual counts for this period. Amount = rate × count.</p>
        </div>
      </div>
      <div className="panel-body">
        <form action={saveMemberPackageEntriesAction} className="form-grid">
          <input type="hidden" name="run_id" value={run.id} />
          <input type="hidden" name="run_line_id" value={line.id} />
          <input type="hidden" name="redirect_to" value={redirectTo} />
          {PACKAGE_TYPES.map((type) => {
            const entry = entries.find((row) => row.package_type === type);
            const rateRow = rates.find((row) => row.packageType === type);
            const rate = Number(entry?.rate ?? rateRow?.effectiveRate ?? 0);
            const qty = Number(entry?.quantity ?? 0);
            return (
              <div className="field" key={type}>
                <label htmlFor={`qty-${type}`}>{PACKAGE_TYPE_LABELS[type]}</label>
                <input
                  id={`qty-${type}`}
                  name={`qty_${type}`}
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={qty || ""}
                  placeholder="0"
                  disabled={!editable}
                />
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Rate ₹{rate}/unit{rateRow?.overrideRate !== null && rateRow?.overrideRate !== undefined ? " (override)" : " (default)"} · {money.format(qty * rate)}
                </div>
                {editable ? <input type="hidden" name={`rate_${type}`} value={rate} /> : null}
              </div>
            );
          })}
          {editable ? <div style={{ alignSelf: "end" }}><SubmitButton className="button primary" pendingLabel="Saving…">Save package counts</SubmitButton></div> : null}
        </form>
      </div>
    </section> : null}

    {line.pay_type === "package" && editable ? <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <div>
          <h2>Member rate overrides</h2>
          <p className="panel-subtitle">Leave blank to use the company default. Overrides apply only to this member.</p>
        </div>
      </div>
      <div className="panel-body">
        <form action={saveMemberPackageRatesAction} className="form-grid">
          <input type="hidden" name="run_id" value={run.id} />
          <input type="hidden" name="run_line_id" value={line.id} />
          <input type="hidden" name="payee_type" value={line.payee_type} />
          <input type="hidden" name="payee_id" value={line.payee_id} />
          <input type="hidden" name="redirect_to" value={redirectTo} />
          {PACKAGE_TYPES.map((type) => {
            const entry = entries.find((row) => row.package_type === type);
            const rateRow = rates.find((row) => row.packageType === type);
            return (
              <div className="field" key={type}>
                <label htmlFor={`override-${type}`}>{PACKAGE_TYPE_LABELS[type]} override (₹)</label>
                <input
                  id={`override-${type}`}
                  name={`override_${type}`}
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={rateRow?.overrideRate ?? ""}
                  placeholder={`Default ${rateRow?.defaultRate ?? 0}`}
                />
                <input type="hidden" name={`qty_${type}`} value={Number(entry?.quantity ?? 0)} />
              </div>
            );
          })}
          <div style={{ alignSelf: "end" }}><SubmitButton className="button secondary" pendingLabel="Saving…">Save rate overrides</SubmitButton></div>
        </form>
      </div>
    </section> : null}

    {editable && line.pay_type === "package" ? <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head"><h2>One-off adjustment</h2></div>
      <div className="panel-body">
        <form action={addAdjustmentAction} className="form-grid">
          <input type="hidden" name="run_id" value={run.id} />
          <input type="hidden" name="run_line_id" value={line.id} />
          <input type="hidden" name="redirect_to" value={redirectTo} />
          <div className="field"><label htmlFor="pkg-adj-name">Description</label><input id="pkg-adj-name" name="name" placeholder="e.g. Special incentive" required /></div>
          <div className="field"><label htmlFor="pkg-adj-amount">Amount (₹)</label><input id="pkg-adj-amount" name="amount" type="number" min="0.01" step="0.01" required /></div>
          <div className="field"><label htmlFor="pkg-adj-type">Type</label><select id="pkg-adj-type" name="type" defaultValue="earning"><option value="earning">Earning</option><option value="deduction">Deduction</option><option value="employer_contribution">Employer contribution</option></select></div>
          <div style={{ alignSelf: "end" }}><SubmitButton className="button secondary" pendingLabel="Adding…">Add adjustment</SubmitButton></div>
        </form>
      </div>
    </section> : null}
  </>;
}
