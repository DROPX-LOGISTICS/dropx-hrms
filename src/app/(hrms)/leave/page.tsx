import type { Metadata } from "next";
import Link from "next/link";
import { LeaveRequestForm } from "@/components/leave-request-form";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { listActiveEmployeeOptions, listLeaveRequests, listLeaveTypes } from "@/lib/data";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Leave" };

export default async function LeavePage({ searchParams }: { searchParams?: { request?: string; status?: string; page?: string } }) {
  const auth = await requireHrmsAuth("leave.view");
  const mayRequest = can(auth.permissions, "leave.request");
  const requesting = searchParams?.request === "1" && mayRequest;
  const [{ rows: requests, total, page, pageSize }, types, employees] = await Promise.all([
    listLeaveRequests(auth, searchParams?.status, { page: searchParams?.page }),
    listLeaveTypes(auth),
    requesting ? listActiveEmployeeOptions(auth) : Promise.resolve([])
  ]);
  return <>
    <PageHeader eyebrow="Time away" title="Leave" description="Submit and track employee leave requests." action={mayRequest ? <Link className="button primary" href="/leave?request=1">Request leave</Link> : undefined} />
    {requesting ? <LeaveRequestForm employees={employees} types={types} /> : null}
    <section className="panel">
      <div className="panel-head"><h2>Leave register</h2><form className="toolbar" method="get"><select aria-label="Leave status" name="status" defaultValue={searchParams?.status ?? ""}><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select><SubmitButton className="button secondary small" pendingLabel="Loading…">Apply</SubmitButton><Link className="button secondary small" href="/leave">Reset</Link></form></div>
      <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Leave type</th><th>Period</th><th>Days</th><th>Reason</th><th>Status</th><th>Reviewer note</th></tr></thead><tbody>{requests.length ? requests.map((item) => <tr key={item.id}><td><strong>{item.employees?.full_name ?? "Employee"}</strong><div className="muted">{item.employees?.employee_code ?? "—"}</div></td><td>{item.hr_leave_types?.name ?? "—"}</td><td>{item.start_date}<div className="muted">to {item.end_date}</div></td><td>{item.days}</td><td>{item.reason}</td><td><StatusPill value={item.status} /></td><td>{item.reviewer_note ?? "—"}</td></tr>) : <tr><td className="empty-cell" colSpan={7}>No leave requests match this filter.</td></tr>}</tbody></table></div>
      <Pagination page={page} pageSize={pageSize} total={total} basePath="/leave" searchParams={searchParams} />
    </section>
  </>;
}
