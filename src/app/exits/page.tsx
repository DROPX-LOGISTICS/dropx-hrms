import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SearchableSelect } from "@/components/searchable-select";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { listExitCases, listExitEligibleEmployees, loadExitMasters } from "@/lib/exit-data";
import { can } from "@/lib/permissions";
import { createTerminationCase } from "./actions";

export const metadata: Metadata = { title: "Exit Management" };
export const dynamic = "force-dynamic";

export default async function ExitsPage({ searchParams }: { searchParams?: { create?: string; error?: string; notice?: string; search?: string; status?: string; scenario?: string } }) {
  const auth = await requireHrmsAuth("exit.view");
  const [cases, employees, masters] = await Promise.all([listExitCases(auth, searchParams), listExitEligibleEmployees(auth), loadExitMasters(auth)]);
  const manage = can(auth.permissions, "exit.manage");
  const allCases = await listExitCases(auth);
  const open = allCases.filter((item) => !["closed","rejected","withdrawn","cancelled"].includes(item.status)).length;
  const clearance = allCases.filter((item) => ["clearance","ready_to_close"].includes(item.status) || item.current_stage === "clearance").length;
  const ready = allCases.filter((item) => item.status === "documents_ready").length;
  const closed = allCases.filter((item) => item.status === "closed").length;
  const terminationReasons = masters.reasons.filter((reason) => reason.scenario === "termination" && reason.is_active);
  const relation = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] ?? null : value ?? null;
  return <AppShell auth={auth} active="Exit Management">
    <PageHeader eyebrow="Employee lifecycle" title="Exit Management" description="Manage resignations and company-initiated separations through approvals, clearance, settlement and generated documents." action={manage ? <Link className="button primary" href="/exits?create=termination">Start termination</Link> : undefined} />
    {searchParams?.error ? <div className="alert error" role="alert">{searchParams.error}</div> : null}
    {searchParams?.notice ? <div className="alert success" role="status">{searchParams.notice}</div> : null}
    <section className="grid stats-grid">
      <article className="card stat"><span className="stat-label">Open exits</span><strong className="stat-value">{open}</strong><span className="stat-meta">All active exit cases</span></article>
      <article className="card stat"><span className="stat-label">In clearance</span><strong className="stat-value">{clearance}</strong><span className="stat-meta">Handover or no-dues pending</span></article>
      <article className="card stat"><span className="stat-label">Documents ready</span><strong className="stat-value">{ready}</strong><span className="stat-meta">Ready for final closure</span></article>
      <article className="card stat"><span className="stat-label">Closed</span><strong className="stat-value">{closed}</strong><span className="stat-meta">Completed exits</span></article>
    </section>
    {searchParams?.create === "termination" && manage ? <section className="panel employee-form-panel">
      <div className="panel-head"><div><h2>Start company-initiated separation</h2><p className="panel-subtitle">Only active employees without another open exit case are shown.</p></div><Link className="button secondary small" href="/exits">Close</Link></div>
      <div className="panel-body"><form action={createTerminationCase}><div className="form-grid">
        <div className="field"><label htmlFor="termination_employee">Employee *</label><SearchableSelect id="termination_employee" name="employee_id" placeholder="Search employee" required options={employees.map((employee) => ({ value: employee.id, label: `${employee.employee_code ?? "-"} - ${employee.full_name}` }))} /></div>
        <div className="field"><label htmlFor="termination_reason">Reason *</label><SearchableSelect id="termination_reason" name="reason_id" placeholder="Search reason" required options={terminationReasons.map((reason) => ({ value: reason.id, label: reason.name }))} /></div>
        <div className="field"><label htmlFor="effective_date">Effective / proposed last working date *</label><input id="effective_date" name="effective_date" type="date" required /></div>
        <div className="field wide"><label htmlFor="confidential_reason">Detailed business rationale *</label><textarea id="confidential_reason" name="confidential_reason" minLength={3} required /></div>
      </div><div className="form-actions"><Link className="button secondary" href="/exits">Cancel</Link><SubmitButton className="button primary" pendingLabel="Creating exit case…">Create and route for approval</SubmitButton></div></form></div>
    </section> : null}
    <section className="panel">
      <div className="panel-head"><h2>Exit register</h2><form className="toolbar" method="get">
        <input aria-label="Search exit cases" name="search" placeholder="Case, employee or ID" defaultValue={searchParams?.search} />
        <select aria-label="Exit scenario" name="scenario" defaultValue={searchParams?.scenario ?? ""}><option value="">All scenarios</option><option value="resignation">Resignation</option><option value="termination">Termination</option><option value="other">Other</option></select>
        <select aria-label="Exit status" name="status" defaultValue={searchParams?.status ?? ""}><option value="">All statuses</option>{["submitted","under_review","approved","notice_period","clearance","documents_ready","closed","rejected","withdrawal_requested","withdrawn","on_hold"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select>
        <SubmitButton className="button secondary small" pendingLabel="Loading…">Apply</SubmitButton><Link className="button secondary small" href="/exits">Reset</Link>
      </form></div>
      <div className="table-wrap"><table><thead><tr><th>Case</th><th>Employee</th><th>Type</th><th>Last working date</th><th>Stage</th><th>Status</th><th>Action</th></tr></thead><tbody>{cases.length ? cases.map((item) => {
        const employee = relation(item.employees); const station = relation(employee?.stations);
        return <tr key={item.id}><td><strong>{item.case_number}</strong><div className="muted">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(item.submitted_at))}</div></td><td><strong>{employee?.full_name ?? "Employee"}</strong><div className="muted">{employee?.employee_code ?? "-"}{station?.station_code ? ` · ${station.station_code}` : ""}</div></td><td className="capitalize">{item.scenario}</td><td>{item.approved_last_working_date ?? item.requested_last_working_date ?? "-"}</td><td className="capitalize">{item.current_stage.replaceAll("_", " ")}</td><td><StatusPill value={item.status.replaceAll("_", " ")} /></td><td><Link className="button secondary small" href={`/exits/${item.id}`}>Open case</Link></td></tr>;
      }) : <tr><td className="empty-cell" colSpan={7}>No exit cases match this filter.</td></tr>}</tbody></table></div>
    </section>
  </AppShell>;
}
