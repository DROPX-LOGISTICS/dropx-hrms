"use client";

import Link from "next/link";
import { EllipsisVertical, Eye, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function EmployeeActionsMenu({ employeeId, employeeName, canEdit }: { employeeId: string; employeeName: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
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

  return <div className="row-actions-menu" ref={rootRef}>
    <button className="row-actions-trigger" type="button" aria-label={`Actions for ${employeeName}`} aria-haspopup="menu" aria-expanded={open} onClick={toggleMenu}><EllipsisVertical size={18} /></button>
    {open ? createPortal(<div className="row-actions-popover" ref={popoverRef} role="menu" aria-label={`Actions for ${employeeName}`} style={{ top: position.top, right: position.right }}>
      <Link role="menuitem" href={`/people/${employeeId}`} onClick={() => setOpen(false)}><Eye size={15} />View</Link>
      {canEdit ? <Link role="menuitem" href={`/people/${employeeId}?edit=1`} onClick={() => setOpen(false)}><Pencil size={15} />Edit</Link> : null}
    </div>, document.body) : null}
  </div>;
}
