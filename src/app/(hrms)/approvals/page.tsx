import type { Metadata } from "next";
import { ApprovalDecisionForm } from "@/components/approval-decision-form";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { requireHrmsAuth } from "@/lib/auth";
import { listLeaveRequests } from "@/lib/data";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage({ searchParams }: { searchParams?: { page?: string } }) {
  const auth = await requireHrmsAuth("leave.approve");
  const { rows: requests, total, page, pageSize } = await listLeaveRequests(auth, "pending", { page: searchParams?.page, pageSize: 50 });
  return <>
    <PageHeader eyebrow="Workflow inbox" title="Approvals" description="Approve or reject pending leave with an auditable reviewer note." />
    <section className="panel">
      <div className="panel-head"><h2>Pending leave requests</h2><span className="status-pill pending">{total} pending</span></div>
      <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Leave</th><th>Period</th><th>Days</th><th>Reason</th><th>Decision</th></tr></thead><tbody>
        {requests.length ? requests.map((item) => <tr key={item.id}>
          <td><strong>{item.employees?.full_name ?? "Employee"}</strong><div className="muted">{item.employees?.employee_code ?? "—"}</div></td>
          <td>{item.hr_leave_types?.name ?? "—"}</td>
          <td>{item.start_date}<div className="muted">to {item.end_date}</div></td>
          <td>{item.days}</td>
          <td>{item.reason}</td>
          <td><ApprovalDecisionForm requestId={item.id} employeeName={item.employees?.full_name ?? "employee"} /></td>
        </tr>) : <tr><td className="empty-cell" colSpan={6}>No leave requests are awaiting approval.</td></tr>}
      </tbody></table></div>
      <Pagination page={page} pageSize={pageSize} total={total} basePath="/approvals" searchParams={searchParams} />
    </section>
  </>;
}
