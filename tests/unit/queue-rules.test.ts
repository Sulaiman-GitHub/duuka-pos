import { describe, expect, it } from "vitest";
import { uploadableBy } from "@/lib/offline/queue-rules";
import type { QueuedSale } from "@/lib/offline/types";

const sale = (clientId: string, cashierId: string, status: "pending" | "failed" = "pending") =>
  ({ clientId, status, payload: { cashierId } } as unknown as QueuedSale);
const queue = [sale("a1", "anna"), sale("b1", "ben"), sale("a2", "anna"), sale("a3", "anna", "failed")];

describe("who may upload which waiting sales", () => {
  it("a cashier uploads only their own, never someone else's, and skips failed ones", () => {
    expect(uploadableBy(queue, { userId: "ben", canUploadAll: false }).map((q) => q.clientId)).toEqual(["b1"]);
    expect(uploadableBy(queue, { userId: "anna", canUploadAll: false }).map((q) => q.clientId)).toEqual(["a1", "a2"]);
    expect(uploadableBy(queue, { userId: "carl", canUploadAll: false })).toEqual([]);
  });
  it("a manager or admin can upload everyone's pending sales", () => {
    expect(uploadableBy(queue, { userId: "mary", canUploadAll: true }).map((q) => q.clientId)).toEqual(["a1", "b1", "a2"]);
  });
});
