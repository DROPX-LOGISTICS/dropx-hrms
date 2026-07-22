import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { listAttendance, listLocations } from "@/lib/data";

export const metadata: Metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function time(value: string | null) { return value ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—"; }
function duration(minutes: number) { return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }

export default async function AttendancePage({ searchParams }: { searchParams?: { date?: string; location?: string } }) {
  const auth = await requireHrmsAuth("attendance.view");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(searchParams?.date ?? "") ? searchParams!.date! : today();
  const [rows, locations] = await Promise.all([listAttendance(auth, { date, location: searchParams?.location }), listLocations(auth)]);
  const present = rows.filter((row) => row.status === "P").length;
  return <AppShell auth={auth} active="Attendance"><PageHeader eyebrow="Biometric workforce" title="Attendance" description="Live employee attendance calculated from DropX biometric punches." /><section className="grid stats-grid"><article className="card stat"><span className="stat-label">Attendance rows</span><strong className="stat-value">{rows.length}</strong></article><article className="card stat"><span className="stat-label">Present</span><strong className="stat-value">{present}</strong></article><article className="card stat"><span className="stat-label">Other status</span><strong className="stat-value">{rows.length - present}</strong></article><article className="card stat"><span className="stat-label">Selected date</span><strong className="stat-value" style={{ fontSize: 21 }}>{date}</strong></article></section><section className="panel"><div className="panel-head"><h2>Daily register</h2><form className="toolbar" method="get"><input aria-label="Attendance date" type="date" name="date" defaultValue={date} /><select aria-label="Attendance location" name="location" defaultValue={searchParams?.location ?? ""}><option value="">All locations</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.station_code}</option>)}</select><SubmitButton className="button secondary small" pendingLabel="Loading…">Apply</SubmitButton><Link className="button secondary small" href="/attendance">Today</Link></form></div><div className="table-wrap"><table><thead><tr><th>Employee</th><th>Location</th><th>In</th><th>Out</th><th>Work time</th><th>Punches</th><th>Status</th><th>Remark</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}><td><strong>{row.employees?.full_name ?? "Unknown employee"}</strong><div className="muted">{row.employees?.employee_code ?? row.employee_id}</div></td><td>{row.stations?.station_code ?? "—"}</td><td>{time(row.in_time)}</td><td>{time(row.out_time)}</td><td>{duration(row.work_minutes)}</td><td>{row.punch_count}</td><td><StatusPill value={row.status} /></td><td>{row.remark ?? "—"}</td></tr>) : <tr><td className="empty-cell" colSpan={8}>No employee attendance was calculated for this date.</td></tr>}</tbody></table></div></section></AppShell>;
}
