import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CircleDollarSign, DoorOpen, ListTree } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { loadCompanySettings } from "@/lib/data";
import { saveAttendanceSettings } from "./actions";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const week = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" }
];

export default async function SettingsPage({ searchParams }: { searchParams?: { error?: string; notice?: string } }) {
  const auth = await requireHrmsAuth("settings.manage");
  const settings = await loadCompanySettings(auth);
  const workWeek = new Set<string>(settings?.work_week ?? ["mon", "tue", "wed", "thu", "fri", "sat"]);
  return <AppShell auth={auth} active="Settings">
    <PageHeader eyebrow="Administration" title="Settings" description="Manage attendance, leave, payroll and exit policy masters." />
    {searchParams?.error ? <div className="alert error">{searchParams.error}</div> : null}
    {searchParams?.notice ? <div className="alert success">{searchParams.notice}</div> : null}

    <section className="settings-directory">
      <Link className="settings-card" href="/settings/payroll-heads"><ListTree size={20} /><span><strong>Payroll Heads</strong><small>Create earning, deduction and statutory payroll heads.</small></span></Link>
      <Link className="settings-card" href="/settings/leave-policy"><CalendarDays size={20} /><span><strong>Leave Policy</strong><small>Configure the leave year and leave types.</small></span></Link>
      <Link className="settings-card" href="/settings/salary"><CircleDollarSign size={20} /><span><strong>Salary Configuration</strong><small>Create salary structures with values, equations and limits.</small></span></Link>
      <Link className="settings-card" href="/settings/exit"><DoorOpen size={20} /><span><strong>Exit Masters</strong><small>Configure reasons, tasks, documents and notifications.</small></span></Link>
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Attendance policy</h2><p className="panel-subtitle">Company-wide working days and attendance thresholds.</p></div></div>
      <div className="panel-body"><form action={saveAttendanceSettings}>
        <div className="field"><label>Working days</label><div className="inline-actions">{week.map((day) => <label key={day.value} className="button secondary small"><input type="checkbox" name="work_week" value={day.value} defaultChecked={workWeek.has(day.value)} /> {day.label}</label>)}</div></div>
        <div className="form-grid" style={{ marginTop: 16 }}>
          <div className="field"><label htmlFor="attendance_grace_minutes">Grace period (minutes)</label><input id="attendance_grace_minutes" name="attendance_grace_minutes" type="number" min="0" max="180" defaultValue={settings?.attendance_grace_minutes ?? 15} required /></div>
          <div className="field"><label htmlFor="full_day_minutes">Full day (minutes)</label><input id="full_day_minutes" name="full_day_minutes" type="number" min="60" defaultValue={settings?.full_day_minutes ?? 480} required /></div>
          <div className="field"><label htmlFor="half_day_minutes">Half day (minutes)</label><input id="half_day_minutes" name="half_day_minutes" type="number" min="30" defaultValue={settings?.half_day_minutes ?? 240} required /></div>
        </div>
        <div className="form-actions"><SubmitButton className="button primary" pendingLabel="Saving attendance policy…">Save attendance policy</SubmitButton></div>
      </form></div>
    </section>
  </AppShell>;
}
