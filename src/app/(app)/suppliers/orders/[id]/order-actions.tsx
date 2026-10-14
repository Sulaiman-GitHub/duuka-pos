"use client";

import { Printer } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui";
import { cancelOrder, markOrdered } from "../../actions";

export function OrderActions({ id, status, canCancel }: { id: string; status: string; canCancel: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="no-print flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print</Button>
      {status === "DRAFT" && <Button disabled={pending} onClick={() => start(() => markOrdered(id))}>Mark as ordered</Button>}
      {canCancel && <Button variant="danger" disabled={pending} onClick={() => { if (confirm("Cancel this purchase order?")) start(() => cancelOrder(id)); }}>Cancel order</Button>}
    </div>
  );
}
