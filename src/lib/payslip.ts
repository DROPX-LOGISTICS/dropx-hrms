import "server-only";
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import type { PayeeBankDetails, PayrollRunLineRow, PayrollRunRow } from "@/lib/payroll-run";

// pdf-lib's standard fonts use WinAnsi encoding, which cannot render the "₹" glyph (U+20B9).
// Use a plain "Rs." prefix inside PDFs instead of Intl's currency symbol.
const moneyNumberFormat = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function money(value: number) {
  return `Rs. ${moneyNumberFormat.format(value)}`;
}

function periodLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) current = candidate;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}

export async function createPayslipPdf(input: { companyName: string; run: PayrollRunRow; line: PayrollRunLineRow; payee: PayeeBankDetails }) {
  const { companyName, run, line, payee } = input;
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 595.28;
  const height = 841.89;
  const margin = 50;
  const page = pdf.addPage([width, height]);
  let y = height - 56;

  page.drawRectangle({ x: 0, y: height - 10, width, height: 10, color: rgb(0.82, 0.12, 0.21) });
  page.drawText(companyName, { x: margin, y, size: 17, font: bold, color: rgb(0.13, 0.13, 0.13) });
  y -= 20;
  page.drawText("PAYSLIP", { x: margin, y, size: 10.5, font: bold, color: rgb(0.82, 0.12, 0.21) });
  const periodText = periodLabel(run.period_month);
  const periodWidth = regular.widthOfTextAtSize(periodText, 10.5);
  page.drawText(periodText, { x: width - margin - periodWidth, y, size: 10.5, font: regular, color: rgb(0.35, 0.35, 0.35) });
  y -= 14;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.88, 0.88, 0.88) });
  y -= 26;

  const infoLeft: [string, string][] = [
    ["Employee / Payee", payee.fullName],
    ["Code", payee.code ?? "—"],
    ["Designation", payee.designation ?? "—"]
  ];
  const infoRight: [string, string][] = [
    ["Pay type", line.pay_type === "monthly" ? "Monthly salary" : "Job / package pay"],
    ["Bank account", payee.bankAccountNo ?? "—"],
    ["IFSC", payee.ifsc ?? "—"]
  ];
  const rowY0 = y;
  infoLeft.forEach(([label, value], index) => {
    const rowY = rowY0 - index * 16;
    page.drawText(`${label}:`, { x: margin, y: rowY, size: 9, font: bold, color: rgb(0.35, 0.35, 0.35) });
    page.drawText(value, { x: margin + 108, y: rowY, size: 9, font: regular, color: rgb(0.15, 0.15, 0.15) });
  });
  infoRight.forEach(([label, value], index) => {
    const rowY = rowY0 - index * 16;
    const colX = width / 2 + 10;
    page.drawText(`${label}:`, { x: colX, y: rowY, size: 9, font: bold, color: rgb(0.35, 0.35, 0.35) });
    page.drawText(value, { x: colX + 90, y: rowY, size: 9, font: regular, color: rgb(0.15, 0.15, 0.15) });
  });
  y = rowY0 - infoLeft.length * 16 - 12;

  if (line.pay_type === "monthly") {
    const attendanceRow: [string, string][] = [
      ["Working days", String(line.working_days)],
      ["Present days", String(line.present_days)],
      ["Paid leave", String(line.paid_leave_days)],
      ["LOP days", String(line.lop_days)]
    ];
    attendanceRow.forEach(([label, value], index) => {
      const colWidth = (width - margin * 2) / attendanceRow.length;
      const x = margin + index * colWidth;
      page.drawText(label, { x, y, size: 8, font: regular, color: rgb(0.45, 0.45, 0.45) });
      page.drawText(value, { x, y: y - 13, size: 10.5, font: bold, color: rgb(0.13, 0.13, 0.13) });
    });
    y -= 34;
  }

  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.88, 0.88, 0.88) });
  y -= 20;

  const earnings = (line.hr_payroll_run_line_items ?? []).filter((item) => item.component_type === "earning");
  const deductions = (line.hr_payroll_run_line_items ?? []).filter((item) => item.component_type === "deduction");
  const employerContributions = (line.hr_payroll_run_line_items ?? []).filter((item) => item.component_type === "employer_contribution");

  const colWidth = (width - margin * 2 - 20) / 2;
  const earningsX = margin;
  const deductionsX = margin + colWidth + 20;
  const tableTop = y;

  page.drawText("Earnings", { x: earningsX, y, size: 10, font: bold, color: rgb(0.13, 0.13, 0.13) });
  page.drawText("Deductions", { x: deductionsX, y, size: 10, font: bold, color: rgb(0.13, 0.13, 0.13) });
  y -= 16;
  let earningsY = y;
  let deductionsY = y;

  for (const item of earnings) {
    page.drawText(item.component_name, { x: earningsX, y: earningsY, size: 9, font: regular, color: rgb(0.2, 0.2, 0.2) });
    const amountText = money(item.amount);
    const amountWidth = regular.widthOfTextAtSize(amountText, 9);
    page.drawText(amountText, { x: earningsX + colWidth - amountWidth, y: earningsY, size: 9, font: regular, color: rgb(0.2, 0.2, 0.2) });
    earningsY -= 15;
  }
  for (const item of deductions) {
    page.drawText(item.component_name, { x: deductionsX, y: deductionsY, size: 9, font: regular, color: rgb(0.2, 0.2, 0.2) });
    const amountText = money(item.amount);
    const amountWidth = regular.widthOfTextAtSize(amountText, 9);
    page.drawText(amountText, { x: deductionsX + colWidth - amountWidth, y: deductionsY, size: 9, font: regular, color: rgb(0.2, 0.2, 0.2) });
    deductionsY -= 15;
  }
  if (!earnings.length) { page.drawText("No earnings recorded.", { x: earningsX, y: earningsY, size: 9, font: regular, color: rgb(0.5, 0.5, 0.5) }); earningsY -= 15; }
  if (!deductions.length) { page.drawText("No deductions.", { x: deductionsX, y: deductionsY, size: 9, font: regular, color: rgb(0.5, 0.5, 0.5) }); deductionsY -= 15; }

  y = Math.min(earningsY, deductionsY) - 6;
  page.drawLine({ start: { x: margin, y: tableTop - (Math.max(earnings.length, deductions.length, 1) * 15 + 16) - 4 }, end: { x: width - margin, y: tableTop - (Math.max(earnings.length, deductions.length, 1) * 15 + 16) - 4 }, thickness: 0.6, color: rgb(0.9, 0.9, 0.9) });

  const grossWidth = regular.widthOfTextAtSize(money(line.gross_earnings), 9.5);
  const deductionWidth = regular.widthOfTextAtSize(money(line.total_deductions), 9.5);
  page.drawText("Gross earnings", { x: earningsX, y, size: 9.5, font: bold, color: rgb(0.13, 0.13, 0.13) });
  page.drawText(money(line.gross_earnings), { x: earningsX + colWidth - grossWidth, y, size: 9.5, font: bold, color: rgb(0.13, 0.13, 0.13) });
  page.drawText("Total deductions", { x: deductionsX, y, size: 9.5, font: bold, color: rgb(0.13, 0.13, 0.13) });
  page.drawText(money(line.total_deductions), { x: deductionsX + colWidth - deductionWidth, y, size: 9.5, font: bold, color: rgb(0.13, 0.13, 0.13) });
  y -= 26;

  if (employerContributions.length) {
    page.drawText("Employer contributions (not part of net pay)", { x: margin, y, size: 8.5, font: bold, color: rgb(0.45, 0.45, 0.45) });
    y -= 14;
    for (const item of employerContributions) {
      page.drawText(item.component_name, { x: margin, y, size: 8.5, font: regular, color: rgb(0.45, 0.45, 0.45) });
      const amountText = money(item.amount);
      const amountWidth = regular.widthOfTextAtSize(amountText, 8.5);
      page.drawText(amountText, { x: margin + colWidth - amountWidth, y, size: 8.5, font: regular, color: rgb(0.45, 0.45, 0.45) });
      y -= 13;
    }
    y -= 6;
  }

  y -= 6;
  page.drawRectangle({ x: margin, y: y - 30, width: width - margin * 2, height: 40, color: rgb(0.97, 0.97, 0.97) });
  page.drawText("Net pay", { x: margin + 16, y: y - 12, size: 12, font: bold, color: rgb(0.13, 0.13, 0.13) });
  const netText = money(line.net_pay);
  const netWidth = bold.widthOfTextAtSize(netText, 14);
  page.drawText(netText, { x: width - margin - 16 - netWidth, y: y - 13, size: 14, font: bold, color: rgb(0.82, 0.12, 0.21) });

  const footerText = "System-generated payslip from DropX HRMS. Contact HR for any discrepancy.";
  for (const footerLine of wrapLine(footerText, regular, 7.5, width - margin * 2)) {
    page.drawText(footerLine, { x: margin, y: 36, size: 7.5, font: regular, color: rgb(0.48, 0.48, 0.48) });
  }
  page.drawLine({ start: { x: margin, y: 52 }, end: { x: width - margin, y: 52 }, thickness: 0.6, color: rgb(0.88, 0.88, 0.88) });

  return pdf.save();
}

export function toBankExportCsv(rows: { payeeType: string; payeeName: string; payeeCode: string | null; bankAccountNo: string | null; ifsc: string | null; netPay: number }[]) {
  const header = ["Payee Type", "Name", "Code", "Bank Account No", "IFSC", "Net Pay"];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push([
      escape(row.payeeType),
      escape(row.payeeName),
      escape(row.payeeCode ?? ""),
      escape(row.bankAccountNo ?? ""),
      escape(row.ifsc ?? ""),
      row.netPay.toFixed(2)
    ].join(","));
  }
  return lines.join("\r\n");
}
