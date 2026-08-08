import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusPill } from "@/components/status-pill";
import { requireHrmsAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { findPayrollRunByPeriod, getPayrollRun, listRunStations } from "@/lib/payroll-run";
import {
  calculateRunAction,
  cancelRunAction,
  lockRunAction,
  markRunPaidAction,
  unlockRunAction
} from "../actions";

export const metadata: Metadata = { title: "Payroll run" };

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
function periodLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default async function PayrollRunDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: {
    error?: string;
    notice?: string;
    search?: string;
    sort?: string;
    page?: string;
    period?: string;
  };
}) {
  const auth = await requireHrmsAuth("payroll.view");
  const canProcess = can(auth.permissions, "payroll.process");

  let periodMissing = false;
  if (searchParams?.period && /^\d{4}-\d{2}/.test(searchParams.period)) {
    const targetId = await findPayrollRunByPeriod(auth, searchParams.period);
    if (targetId && targetId !== params.id) redirect(`/payroll/${targetId}`);
    if (!targetId) periodMissing = true;
  }

  const result = await getPayrollRun(auth, params.id);
  if (!result) notFound();
  const { run } = result;

  const stations = await listRunStations(auth, run.id, {
    search: searchParams?.search,
    sort: searchParams?.sort,
    page: searchParams?.page
  });

  return <>
    <PageHeader
      eyebrow="Salary Process"
      title={periodLabel(run.period_month)}
      description="Browse stations for this generated month, review totals, then open a station to manage members and package pay."
      action={<Link className="button secondary" href="/payroll"><ArrowLeft size={15} /> All runs</Link>}
    />
    {searchParams?.error ? <div className="alert error" role="alert">{searchParams.error}</div> : null}
    {searchParams?.notice ? <div className="alert success" role="status">{searchParams.notice}</div> : null}
    {periodMissing ? <div className="alert error" role="alert">No payroll run exists for that month. Create one from Salary Process, or pick another period.</div> : null}

    <section className="grid stats-grid">
      <article className="card stat"><span className="stat-label">Status</span><strong className="stat-value" style={{ fontSize: 20 }}><StatusPill value={run.status} /></strong></article>
      <article className="card stat"><span className="stat-label">Payees</span><strong className="stat-value">{run.payee_count}</strong></article>
      <article className="card stat"><span className="stat-label">Gross earnings</span><strong className="stat-value" style={{ fontSize: 20 }}>{money.format(run.gross_total)}</strong></article>
      <article className="card stat"><span className="stat-label">Net pay</span><strong className="stat-value" style={{ fontSize: 20 }}>{money.format(run.net_total)}</strong></article>
    </section>

    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <div>
          <h2>Pay period</h2>
          <p className="panel-subtitle">Switch to another generated month. If that period has no run yet, create it from Salary Process.</p>
        </div>
      </div>
      <div className="panel-body">
        <form method="get" className="toolbar" action={`/payroll/${run.id}`}>
          <div className="field">
            <label htmlFor="jump-period-top">Month / year</label>
            <input id="jump-period-top" name="period" type="month" defaultValue={run.period_month.slice(0, 7)} required />
          </div>
          <div style={{ alignSelf: "end" }}><button className="button secondary" type="submit">Open period</button></div>
        </form>
      </div>
    </section>

    {canProcess ? <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head"><div><h2>Run actions</h2><p className="panel-subtitle">Deductions total {money.format(run.deduction_total)} · Employer cost {money.format(run.employer_cost_total)}</p></div>
        <div className="inline-actions">
          {run.status === "draft" || run.status === "calculated" ? <form action={calculateRunAction}><input type="hidden" name="run_id" value={run.id} /><ConfirmSubmitButton
            className="button primary"
            pendingLabel="Calculating…"
            title={run.status === "draft" ? "Calculate this payroll run?" : "Recalculate this payroll run?"}
            message={run.status === "draft"
              ? <>This generates the salary breakup for every payee of {periodLabel(run.period_month)} from salary structures, attendance, leave, and package counts.</>
              : <>The breakup for every payee of {periodLabel(run.period_month)} will be built again. One-off adjustments added earlier are discarded.</>}
            confirmLabel={run.status === "draft" ? "Yes, calculate" : "Yes, recalculate"}
          >{run.status === "draft" ? "Calculate" : "Recalculate"}</ConfirmSubmitButton></form> : null}
          {run.status === "calculated" ? <form action={lockRunAction}><input type="hidden" name="run_id" value={run.id} /><ConfirmSubmitButton
            className="button secondary"
            pendingLabel="Locking…"
            title="Lock this payroll run?"
            message="Locked runs cannot be recalculated or edited, and the bank export becomes available. You can unlock the run again if something needs a correction."
            confirmLabel="Yes, lock run"
          >Lock run</ConfirmSubmitButton></form> : null}
          {run.status === "locked" ? <form action={unlockRunAction}><input type="hidden" name="run_id" value={run.id} /><ConfirmSubmitButton
            className="button secondary"
            pendingLabel="Reopening…"
            title="Unlock this payroll run?"
            message="The run reopens for edits and recalculation. Lock it again before marking it as paid."
            confirmLabel="Yes, unlock"
          >Unlock</ConfirmSubmitButton></form> : null}
          {run.status === "locked" ? <form action={markRunPaidAction}><input type="hidden" name="run_id" value={run.id} /><ConfirmSubmitButton
            className="button primary"
            pendingLabel="Marking paid…"
            title="Mark this payroll run as paid?"
            message={<>Confirm only after the bank has processed {money.format(run.net_total)} for {run.payee_count} payee(s). A paid run can no longer be unlocked or cancelled.</>}
            confirmLabel="Yes, mark as paid"
          >Mark as paid</ConfirmSubmitButton></form> : null}
          {run.status === "locked" || run.status === "paid" ? <a className="button secondary" href={`/payroll/${run.id}/bank-export`} target="_blank" rel="noopener noreferrer">Bank export (CSV)</a> : null}
          {run.status !== "paid" ? <form action={cancelRunAction}><input type="hidden" name="run_id" value={run.id} /><ConfirmSubmitButton
            className="button danger"
            confirmClassName="button danger"
            pendingLabel="Cancelling…"
            title="Cancel this payroll run?"
            message={<>Every calculated line for {periodLabel(run.period_month)} is discarded and linked job or package entries are released back for a future run. This cannot be undone.</>}
            confirmLabel="Yes, cancel run"
            cancelLabel="Keep run"
          >Cancel run</ConfirmSubmitButton></form> : null}
        </div>
      </div>
    </section> : null}

    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <div>
          <h2>Stations</h2>
          <p className="panel-subtitle">Totals for members included in this run, grouped by station.</p>
        </div>
      </div>
      <div className="panel-body">
        <form method="get" className="toolbar" action={`/payroll/${run.id}`}>
          <div className="field">
            <label htmlFor="station-search">Search</label>
            <input id="station-search" name="search" defaultValue={searchParams?.search ?? ""} placeholder="Station name or code" />
          </div>
          <div className="field">
            <label htmlFor="station-sort">Sort</label>
            <select id="station-sort" name="sort" defaultValue={searchParams?.sort ?? "name"}>
              <option value="name">Name</option>
              <option value="net">Net pay</option>
              <option value="members">Members</option>
            </select>
          </div>
          <div style={{ alignSelf: "end" }}><button className="button secondary" type="submit">Apply</button></div>
        </form>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Station</th>
              <th>Members</th>
              <th>Gross</th>
              <th>Deductions</th>
              <th>Net pay</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {stations.rows.length ? stations.rows.map((station) => (
              <tr key={station.stationId}>
                <td>
                  <strong>{station.stationName}</strong>
                  <div className="muted">{station.stationCode}</div>
                </td>
                <td>{station.memberCount}</td>
                <td>{money.format(station.grossTotal)}</td>
                <td>{money.format(station.deductionTotal)}</td>
                <td><strong>{money.format(station.netTotal)}</strong></td>
                <td><Link className="button secondary small" href={`/payroll/${run.id}/stations/${station.stationId}`}>Open</Link></td>
              </tr>
            )) : <tr><td className="empty-cell" colSpan={6}>No stations match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination
        page={stations.page}
        pageSize={stations.pageSize}
        total={stations.total}
        basePath={`/payroll/${run.id}`}
        searchParams={{
          search: searchParams?.search,
          sort: searchParams?.sort,
          period: searchParams?.period
        }}
      />
    </section>
  </>;
}
