import type { Metadata } from "next";
import Link from "next/link";
import { ClientRedirect } from "@/components/client-redirect";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { getHrmsAuth } from "@/lib/auth";
import { loadOverview } from "@/lib/data";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Overview" };
export default async function OverviewPage() {
  const auth = await getHrmsAuth();
  if (!auth) return <ClientRedirect href="/login?reason=HRMS%20access%20is%20not%20configured" />;
  if (!can(auth.permissions, "overview.view")) return <ClientRedirect href="/unauthorized" />;

  let data: Awaited<ReturnType<typeof loadOverview>>;
  try {
    data = await loadOverview(auth);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load overview.";
    return (
      <>
        <PageHeader eyebrow="People operations" title="Overview unavailable" description="The dashboard could not load workforce metrics." />
        <div className="alert error" role="alert">{message}</div>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="People operations" title="Good day, let’s run HR." description={`Live workforce position for ${data.today}.`} action={<Link className="button primary" href="/people">Open people directory</Link>} />
      <section className="grid stats-grid" aria-label="Workforce summary">
        <article className="card stat"><span className="stat-label">Active employees</span><strong className="stat-value">{data.employees}</strong><span className="stat-meta">Company-scoped employee master</span></article>
        <article className="card stat"><span className="stat-label">Present today</span><strong className="stat-value">{data.present}</strong><span className="stat-meta">Biometric daily attendance</span></article>
        <article className="card stat"><span className="stat-label">Not present</span><strong className="stat-value">{data.absent}</strong><span className="stat-meta">Active employees without P status</span></article>
        <article className="card stat"><span className="stat-label">Pending approvals</span><strong className="stat-value">{data.pending}</strong><span className="stat-meta">Leave requests awaiting review</span></article>
      </section>
      <section className="grid two-column">
        <article className="panel">
          <div className="panel-head"><h2>Recent leave activity</h2><Link className="button secondary small" href="/approvals">Review approvals</Link></div>
          <div className="panel-body">
            {data.recent.length ? <ul className="activity-list">{data.recent.map((item) => <li key={item.id}><div><strong>{item.employees?.full_name ?? "Employee"}</strong><div className="muted">{item.hr_leave_types?.name ?? "Leave"} · {item.start_date} to {item.end_date}</div></div><StatusPill value={item.status} /></li>)}</ul> : <p className="muted">No leave activity yet.</p>}
          </div>
        </article>
        <article className="panel"><div className="panel-head"><h2>Quick actions</h2></div><div className="panel-body grid"><Link className="button secondary" href="/people?add=1">Add employee</Link><Link className="button secondary" href={`/attendance?date=${data.today}`}>View today’s attendance</Link><Link className="button secondary" href="/leave?request=1">Request leave</Link></div></article>
      </section>
    </>
  );
}
