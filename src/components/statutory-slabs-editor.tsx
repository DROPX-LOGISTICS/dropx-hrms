"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { PtSlab } from "@/lib/statutory";

export function StatutorySlabsEditor({ slabs }: { slabs: PtSlab[] }) {
  const sequence = useRef(0);
  const [rows, setRows] = useState(() => slabs.map((slab) => ({ key: slab.id, ...slab })));

  function addRow() {
    sequence.current += 1;
    const key = `new-${sequence.current}`;
    setRows((current) => [...current, { key, id: key, minIncome: 0, maxIncome: null, monthlyTax: 0 }]);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function updateRow(key: string, values: Partial<{ minIncome: number; maxIncome: number | null; monthlyTax: number }>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...values } : row)));
  }

  return <div className="field wide">
    <label>Professional tax slabs</label>
    <small>Monthly gross salary ranges and the professional tax charged in that range. Leave the upper limit blank for the top slab.</small>
    <div className="table-wrap" style={{ marginTop: 8 }}>
      <table>
        <thead><tr><th>From (₹)</th><th>To (₹)</th><th>Monthly tax (₹)</th><th>Action</th></tr></thead>
        <tbody>
          {rows.length ? rows.map((row) => <tr key={row.key}>
            <td>
              <input aria-label="Slab minimum income" name="slab_min" type="number" min="0" step="1" value={row.minIncome} onChange={(event) => updateRow(row.key, { minIncome: Number(event.target.value) })} />
            </td>
            <td>
              <input aria-label="Slab maximum income" name="slab_max" type="number" min="0" step="1" value={row.maxIncome ?? ""} placeholder="No limit" onChange={(event) => updateRow(row.key, { maxIncome: event.target.value === "" ? null : Number(event.target.value) })} />
            </td>
            <td>
              <input aria-label="Slab monthly tax" name="slab_amount" type="number" min="0" step="0.01" value={row.monthlyTax} onChange={(event) => updateRow(row.key, { monthlyTax: Number(event.target.value) })} />
            </td>
            <td><button aria-label="Remove slab" className="icon-button danger" type="button" onClick={() => removeRow(row.key)}><Trash2 size={15} /></button></td>
          </tr>) : <tr><td className="empty-cell" colSpan={4}>No professional tax slabs configured.</td></tr>}
        </tbody>
      </table>
    </div>
    <div style={{ marginTop: 8 }}><button className="button secondary small" type="button" onClick={addRow}><Plus size={14} /> Add slab</button></div>
  </div>;
}
