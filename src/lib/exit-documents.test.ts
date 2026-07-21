import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { createExitPdf, fillExitTemplate } from "./exit-documents";

describe("exit document generation", () => {
  it("replaces configured placeholders and produces a readable PDF", async () => {
    const body = fillExitTemplate("This certifies that {{employee_name}} worked from {{date_of_joining}} to {{last_working_date}}. Case {{case_number}}.", {
      employee_name: "Asha Verma", date_of_joining: "01 January 2022", last_working_date: "31 July 2026", case_number: "EXIT-2026-00001"
    });
    expect(body).not.toContain("{{");
    const bytes = await createExitPdf({ title: "Experience Certificate", body, companyName: "DropX Logistics", registeredAddress: "Manjeri, Kerala, India", signatoryName: "Authorised Signatory", signatoryTitle: "Human Resources", footerText: "DropX People · Confidential" });
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    await mkdir("tmp/pdfs", { recursive: true });
    await writeFile("tmp/pdfs/exit-document-preview.pdf", bytes);
  });
});
