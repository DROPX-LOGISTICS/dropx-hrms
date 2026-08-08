import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listPayrollRuns, suggestNextPeriod } from "@/lib/payroll-run";
import { createRunAction } from "./actions";

export const metadata: Metadata = { title: "Salary Process" };

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
function periodLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default async function PayrollPage({ searchParams }: { searchParams?: { error?: string; notice?: string } }) {
  const auth = await requireHrmsAuth("payroll.view");
  const canProcess = can(auth.permissions, "payroll.process");
  const runs = await listPayrollRuns(auth);
  const nextPeriod = suggestNextPeriod(runs.map((run) => run.period_month));
  const latestRun = runs[0];

  return <>
    <PageHeader
      eyebrow="Payroll"
      title="Salary Process"
      description="Create a monthly payroll run, then work station by station through members and package pay."
      action={<Link className="button secondary" href="/settings/salary">Package rates</Link>}
    />
    {searchParams?.error ? <div className="alert error" role="alert">{searchParams.error}</div> : null}
    {searchParams?.notice ? <div className="alert success" role="status">{searchParams.notice}</div> : null}

    <section className="grid stats-grid">
      <article className="card stat"><span className="stat-label">Payroll runs</span><strong className="stat-value">{runs.length}</strong></article>
      <article className="card stat"><span className="stat-label">Latest run</span><strong className="stat-value" style={{ fontSize: 18 }}>{latestRun ? periodLabel(latestRun.period_month) : "—"}</strong><span className="stat-meta">{latestRun ? <StatusPill value={latestRun.status} /> : "No runs yet"}</span></article>
      <article className="card stat"><span className="stat-label">Latest net pay</span><strong className="stat-value">{latestRun ? money.format(latestRun.net_total) : "—"}</strong></article>
      <article className="card stat"><span className="stat-label">Stations workflow</span><strong className="stat-value" style={{ fontSize: 18 }}>Run → Station → Member</strong><span className="stat-meta">Open a run to browse stations</span></article>
    </section>

    {canProcess ? <section className="panel">
      <div className="panel-head"><div><h2>Create payroll run</h2><p className="panel-subtitle">Creates a draft run covering every active employee and contractor for the selected month.</p></div></div>
      <div className="panel-body">
        <form action={createRunAction} className="form-grid">
          <div className="field"><label htmlFor="period_month">Pay period *</label><input id="period_month" name="period_month" type="month" defaultValue={nextPeriod.slice(0, 7)} required /></div>
          <div style={{ alignSelf: "end" }}><SubmitButton className="button primary" pendingLabel="Creating run…">Create run</SubmitButton></div>
        </form>
      </div>
    </section> : null}

    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head"><h2>Payroll runs</h2></div>
      <div className="table-wrap"><table><thead><tr><th>Period</th><th>Status</th><th>Payees</th><th>Gross</th><th>Deductions</th><th>Net pay</th><th>Action</th></tr></thead><tbody>
        {runs.length ? runs.map((run) => <tr key={run.id}>
          <td><strong>{periodLabel(run.period_month)}</strong></td>
          <td><StatusPill value={run.status} /></td>
          <td>{run.payee_count}</td>
          <td>{money.format(run.gross_total)}</td>
          <td>{money.format(run.deduction_total)}</td>
          <td><strong>{money.format(run.net_total)}</strong></td>
          <td><Link className="button secondary small" href={`/payroll/${run.id}`}>Open run</Link></td>
        </tr>) : <tr><td className="empty-cell" colSpan={7}>No payroll runs yet. Create one above to get started.</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
