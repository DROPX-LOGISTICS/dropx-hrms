import { NextResponse } from "next/server";
import { getHrmsAuth } from "@/lib/auth";
import { getPayslipData } from "@/lib/payroll-run";
import { createPayslipPdf } from "@/lib/payslip";

export async function GET(_: Request, { params }: { params: { id: string; lineId: string } }) {
  const auth = await getHrmsAuth();
  if (!auth || !auth.permissions.has("payroll.view")) return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  try {
    const { run, line, payee } = await getPayslipData(auth, params.id, params.lineId);
    if (run.status === "draft") return NextResponse.json({ error: "Calculate the payroll run before generating payslips." }, { status: 400 });
    const bytes = await createPayslipPdf({ companyName: auth.companyName, run, line, payee });
    const fileName = `Payslip-${run.period_month.slice(0, 7)}-${(payee.code ?? payee.fullName).replace(/[^a-zA-Z0-9_-]+/g, "-")}.pdf`;
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate payslip." }, { status: 400 });
  }
}
