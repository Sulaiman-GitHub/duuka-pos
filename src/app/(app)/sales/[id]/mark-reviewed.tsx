"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { markReviewed } from "../actions";

export function MarkReviewed({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <Button variant="secondary" disabled={pending} onClick={() => start(() => markReviewed(id))}>{pending ? "Saving…" : "Mark as reviewed"}</Button>;
}
