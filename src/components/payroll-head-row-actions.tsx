"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EllipsisVertical, Eye, Pencil, X } from "lucide-react";
import { savePayrollHead, togglePayrollHead } from "@/app/(hrms)/settings/payroll-heads/actions";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SearchableSelect } from "@/components/searchable-select";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { payrollHeadPayTypeOptions, payrollHeadTypeLabel } from "@/lib/payroll-head-options";
import type { PayrollHeadRow } from "@/lib/payroll";

function PayrollHeadModal({ head, mode, onClose }: { head: PayrollHeadRow; mode: "view" | "edit"; onClose: () => void }) {
  const readOnly = mode === "view";
  const titleId = `payroll-head-${mode}-title`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop payroll-head-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="payroll-head-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="payroll-head-modal-head">
          <div>
            <p className="eyebrow">Payroll head</p>
            <h2 id={titleId}>{readOnly ? "View" : "Edit"} {head.name}</h2>
          </div>
          <button className="modal-close-button" type="button" aria-label="Close payroll head" onClick={onClose}><X size={19} /></button>
        </div>
        <div className="payroll-head-modal-body">
          {readOnly ? <dl className="details-grid payroll-head-view">
            <div className="detail"><dt>Name</dt><dd>{head.name}</dd></div>
            <div className="detail"><dt>Code</dt><dd><code>{head.code}</code></dd></div>
            <div className="detail"><dt>Pay type</dt><dd>{payrollHeadTypeLabel[head.head_type]}</dd></div>
            <div className="detail"><dt>Source</dt><dd>{head.is_system ? "Protected system head" : "Custom payroll head"}</dd></div>
            <div className="detail"><dt>Status</dt><dd><StatusPill value={head.is_active ? "active" : "inactive"} /></dd></div>
          </dl> : <>
            <ActionForm action={savePayrollHead}>
              <input name="id" type="hidden" value={head.id} />
              <div className="master-entry-grid payroll-head-edit">
                <div className="field wide"><label htmlFor={`head-name-${head.id}`}>Name</label><input id={`head-name-${head.id}`} name="name" defaultValue={head.name} required /></div>
                <div className="field"><label htmlFor={`head-code-${head.id}`}>Code</label><input id={`head-code-${head.id}`} value={head.code} disabled /><small>Permanent reference code.</small></div>
                <div className="field"><label htmlFor={`head-type-${head.id}`}>Pay type</label><SearchableSelect id={`head-type-${head.id}`} name="head_type" options={payrollHeadPayTypeOptions} defaultValue={head.head_type} placeholder="Search pay type" required /></div>
              </div>
              <div className="payroll-head-modal-actions">
                <button className="button secondary" type="button" onClick={onClose}>Cancel</button>
                <SubmitButton className="button primary" pendingLabel="Saving…">Save payroll head</SubmitButton>
              </div>
            </ActionForm>
            <ActionForm action={togglePayrollHead} className="payroll-head-status-form">
              <input name="id" type="hidden" value={head.id} />
              <input name="next_active" type="hidden" value={head.is_active ? "false" : "true"} />
              <div><strong>{head.is_active ? "Deactivate payroll head" : "Activate payroll head"}</strong><p>{head.is_active ? "Inactive heads are no longer available for new salary configurations." : "Make this head available for salary configurations again."}</p></div>
              {head.is_active ? <ConfirmSubmitButton
                className="button danger small"
                confirmClassName="button danger"
                pendingLabel="Deactivating…"
                title="Deactivate this payroll head?"
                message={<>{head.name} ({head.code}) will no longer be available for new salary configurations. Existing configurations that already use it are not changed.</>}
                confirmLabel="Yes, deactivate"
              >Deactivate</ConfirmSubmitButton> : <SubmitButton className="button secondary small" pendingLabel="Activating…">Activate</SubmitButton>}
            </ActionForm>
          </>}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function PayrollHeadRowActions({ head, canEdit }: { head: PayrollHeadRow; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const [modalMode, setModalMode] = useState<"view" | "edit" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node) && !popoverRef.current?.contains(event.target as Node)) setOpen(false);
    }
    const closeOnViewportChange = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, []);

  function toggleMenu() {
    if (open) return setOpen(false);
    const bounds = rootRef.current?.getBoundingClientRect();
    if (bounds) setPosition({ top: bounds.bottom + 5, right: window.innerWidth - bounds.right });
    setOpen(true);
  }

  function select(mode: "view" | "edit") {
    setOpen(false);
    setModalMode(mode);
  }

  return <div className="row-actions-menu" ref={rootRef}>
    <button
      className="row-actions-trigger"
      type="button"
      aria-label={`Actions for ${head.name}`}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={toggleMenu}
    >
      <EllipsisVertical size={18} />
    </button>
    {open ? createPortal(
      <div
        className="row-actions-popover"
        ref={popoverRef}
        role="menu"
        aria-label={`Actions for ${head.name}`}
        style={{ top: position.top, right: position.right }}
      >
        <button role="menuitem" type="button" onClick={() => select("view")}><Eye size={15} />View</button>
        {canEdit ? <button role="menuitem" type="button" onClick={() => select("edit")}><Pencil size={15} />Edit</button> : null}
      </div>,
      document.body
    ) : null}
    {modalMode ? <PayrollHeadModal key={modalMode} head={head} mode={modalMode} onClose={() => setModalMode(null)} /> : null}
  </div>;
}
