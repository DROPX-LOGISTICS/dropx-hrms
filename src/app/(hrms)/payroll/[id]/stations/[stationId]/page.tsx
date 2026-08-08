import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SearchableSelect } from "@/components/searchable-select";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { PACKAGE_TYPE_LABELS, PACKAGE_TYPES } from "@/lib/package-types";
import { can } from "@/lib/permissions";
import {
  getEffectivePackageRates,
  getPayrollRun,
  getStationLabel,
  listPackageEntriesForRunLines,
  listStationEligiblePayees,
  listStationRunMembers
} from "@/lib/payroll-run";
import { addPayeeToRunAction, saveStationPackageEntriesAction } from "../../../actions";

export const metadata: Metadata = { title: "Payroll station" };

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
function periodLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default async function PayrollStationPage({
  params,
  searchParams
}: {
  params: { id: string; stationId: string };
  searchParams?: { error?: string; notice?: string };
}) {
  const auth = await requireHrmsAuth("payroll.view");
  const canProcess = can(auth.permissions, "payroll.process");
  const runResult = await getPayrollRun(auth, params.id);
  if (!runResult) notFound();
  const { run } = runResult;

  const station = await getStationLabel(auth, params.stationId);
  if (!station) notFound();

  const [members, eligible] = await Promise.all([
    listStationRunMembers(auth, run.id, params.stationId),
    canProcess ? listStationEligiblePayees(auth, run.id, params.stationId) : Promise.resolve([])
  ]);

  const packageMembers = members.filter((member) => member.pay_type === "package");
  const entries = await listPackageEntriesForRunLines(auth, run.id, packageMembers.map((member) => member.id));
  const entriesByLine = new Map<string, typeof entries>();
  for (const entry of entries) {
    const list = entriesByLine.get(entry.run_line_id) ?? [];
    list.push(entry);
    entriesByLine.set(entry.run_line_id, list);
  }

  const effectiveRatesByPayee = new Map<string, Awaited<ReturnType<typeof getEffectivePackageRates>>>();
  await Promise.all(packageMembers.map(async (member) => {
    effectiveRatesByPayee.set(
      `${member.payee_type}:${member.payee_id}`,
      await getEffectivePackageRates(auth, member.payee_type, member.payee_id)
    );
  }));

  const stationNet = members.reduce((sum, member) => sum + Number(member.net_pay ?? 0), 0);
  const editable = canProcess && (run.status === "draft" || run.status === "calculated");
  const redirectTo = `/payroll/${run.id}/stations/${params.stationId}`;

  return <>
    <PageHeader
      eyebrow={periodLabel(run.period_month)}
      title={station.stationName}
      description={`Station ${station.stationCode} · ${members.length} member(s) in this run · Net ${money.format(stationNet)}`}
      action={<Link className="button secondary" href={`/payroll/${run.id}`}><ArrowLeft size={15} /> Stations</Link>}
    />
    {searchParams?.error ? <div className="alert error" role="alert">{searchParams.error}</div> : null}
    {searchParams?.notice ? <div className="alert success" role="status">{searchParams.notice}</div> : null}

    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Members</h2>
          <p className="panel-subtitle">Everyone included in this run for this station.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Pay type</th>
              <th>Status</th>
              <th>Net pay</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {members.length ? members.map((member) => (
              <tr key={member.id}>
                <td><strong>{member.payee_name}</strong><div className="muted capitalize">{member.payee_type}</div></td>
                <td>{member.payee_code ?? "—"}</td>
                <td className="capitalize">{member.pay_type === "monthly" ? "Monthly salary" : "Package pay"}</td>
                <td><StatusPill value={member.status} /></td>
                <td><strong>{money.format(member.net_pay)}</strong></td>
                <td><Link className="button secondary small" href={`/payroll/${run.id}/lines/${member.id}`}>Open</Link></td>
              </tr>
            )) : <tr><td className="empty-cell" colSpan={6}>No members in this run for this station yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    {editable ? <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <div>
          <h2>Add member</h2>
          <p className="panel-subtitle">Shows active people at this station who are not already in the run. Selecting one adds them and removes them from this list.</p>
        </div>
      </div>
      <div className="panel-body">
        {eligible.length ? <form action={addPayeeToRunAction} className="form-grid">
          <input type="hidden" name="run_id" value={run.id} />
          <input type="hidden" name="station_id" value={params.stationId} />
          <input type="hidden" name="redirect_to" value={redirectTo} />
          <div className="field wide">
            <label htmlFor="add-payee">Employee or contractor *</label>
            <SearchableSelect
              id="add-payee"
              name="payee"
              placeholder="Search by name"
              required
              options={eligible.map((payee) => ({
                value: `${payee.type}:${payee.id}`,
                label: `${payee.name}${payee.code ? ` · ${payee.code}` : ""} · ${payee.type === "employee" ? "Employee" : "Contractor"}`
              }))}
            />
          </div>
          <div style={{ alignSelf: "end" }}><SubmitButton className="button primary" pendingLabel="Adding…">Add to run</SubmitButton></div>
        </form> : <div className="alert">Everyone at this station is already included in the run.</div>}
      </div>
    </section> : null}

    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <div>
          <h2>Package pay</h2>
          <p className="panel-subtitle">Enter package counts manually for delivery agents and other package-based payees. Amounts use company default rates, or member overrides when set.</p>
        </div>
      </div>
      {!packageMembers.length ? <div className="panel-body"><div className="alert">No package-pay members at this station in the run.</div></div> : (
        <form action={saveStationPackageEntriesAction}>
          <input type="hidden" name="run_id" value={run.id} />
          <input type="hidden" name="station_id" value={params.stationId} />
          <input type="hidden" name="redirect_to" value={redirectTo} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  {PACKAGE_TYPES.map((type) => <th key={type}>{PACKAGE_TYPE_LABELS[type]}</th>)}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {packageMembers.map((member) => {
                  const lineEntries = entriesByLine.get(member.id) ?? [];
                  const rates = effectiveRatesByPayee.get(`${member.payee_type}:${member.payee_id}`) ?? [];
                  let total = 0;
                  return (
                    <tr key={member.id}>
                      <td>
                        <input type="hidden" name="line_id" value={member.id} />
                        <strong>{member.payee_name}</strong>
                        <div className="muted">{member.payee_code ?? "No code"}</div>
                      </td>
                      {PACKAGE_TYPES.map((type) => {
                        const entry = lineEntries.find((row) => row.package_type === type);
                        const rate = rates.find((row) => row.packageType === type)?.effectiveRate ?? Number(entry?.rate ?? 0);
                        const qty = Number(entry?.quantity ?? 0);
                        const amount = qty * rate;
                        total += amount;
                        return (
                          <td key={type}>
                            {editable ? (
                              <div className="field" style={{ margin: 0, minWidth: 88 }}>
                                <input
                                  name={`qty_${member.id}_${type}`}
                                  type="number"
                                  min="0"
                                  step="1"
                                  defaultValue={qty || ""}
                                  placeholder="0"
                                  aria-label={`${member.payee_name} ${PACKAGE_TYPE_LABELS[type]} count`}
                                />
                                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>₹{rate}/unit</div>
                              </div>
                            ) : (
                              <>
                                <div>{qty}</div>
                                <div className="muted" style={{ fontSize: 12 }}>₹{rate}/unit · {money.format(amount)}</div>
                              </>
                            )}
                          </td>
                        );
                      })}
                      <td><strong>{money.format(total)}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {editable ? <div className="panel-body"><SubmitButton className="button primary" pendingLabel="Saving…">Save package counts</SubmitButton></div> : null}
        </form>
      )}
    </section>
  </>;
}
