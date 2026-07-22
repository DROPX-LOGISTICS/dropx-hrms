import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { listLeaveRequests } from "@/lib/data";
import { reviewLeave } from "./actions";

export const metadata: Metadata = { title: "Approvals" };
export const dynamic = "force-dynamic";

export default async function ApprovalsPage({ searchParams }: { searchParams?: { error?: string; notice?: string } }) {
  const auth = await requireHrmsAuth("leave.approve");
  const requests = await listLeaveRequests(auth, "pending");
  return <AppShell auth={auth} active="Approvals"><PageHeader eyebrow="Workflow inbox" title="Approvals" description="Approve or reject pending leave with an auditable reviewer note." />{searchParams?.error ? <div className="alert error">{searchParams.error}</div> : null}{searchParams?.notice ? <div className="alert success">{searchParams.notice}</div> : null}<section className="panel"><div className="panel-head"><h2>Pending leave requests</h2><span className="status-pill pending">{requests.length} pending</span></div><div className="table-wrap"><table><thead><tr><th>Employee</th><th>Leave</th><th>Period</th><th>Days</th><th>Reason</th><th>Decision</th></tr></thead><tbody>{requests.length ? requests.map((item) => <tr key={item.id}><td><strong>{item.employees?.full_name ?? "Employee"}</strong><div className="muted">{item.employees?.employee_code ?? "—"}</div></td><td>{item.hr_leave_types?.name ?? "—"}</td><td>{item.start_date}<div className="muted">to {item.end_date}</div></td><td>{item.days}</td><td>{item.reason}</td><td><form action={reviewLeave}><input type="hidden" name="request_id" value={item.id} /><div className="inline-actions"><input aria-label={`Reviewer note for ${item.employees?.full_name ?? "employee"}`} name="reviewer_note" placeholder="Reviewer note" /><SubmitButton className="button primary small" name="decision" pendingLabel="Approving…" value="approved">Approve</SubmitButton><SubmitButton className="button danger small" name="decision" pendingLabel="Rejecting…" value="rejected">Reject</SubmitButton></div></form></td></tr>) : <tr><td className="empty-cell" colSpan={6}>No leave requests are awaiting approval.</td></tr>}</tbody></table></div></section></AppShell>;
}
