import { NextResponse } from "next/server";
import { getHrmsAuth } from "@/lib/auth";
import { listBankExportRows } from "@/lib/payroll-run";
import { toBankExportCsv } from "@/lib/payslip";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await getHrmsAuth();
  if (!auth || !auth.permissions.has("payroll.process")) return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  try {
    const { run, rows } = await listBankExportRows(auth, params.id);
    if (run.status !== "locked" && run.status !== "paid") return NextResponse.json({ error: "Lock the run before exporting bank payments." }, { status: 400 });
    const csv = toBankExportCsv(rows.map((row) => ({ payeeType: row.payeeType, payeeName: row.payeeName, payeeCode: row.payeeCode, bankAccountNo: row.bankAccountNo, ifsc: row.ifsc, netPay: row.netPay })));
    const fileName = `Bank-Payments-${run.period_month.slice(0, 7)}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to export bank payments." }, { status: 400 });
  }
}
