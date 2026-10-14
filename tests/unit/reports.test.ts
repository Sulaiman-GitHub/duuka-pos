import { describe, expect, it } from "vitest";
import { kampalaDateString } from "@/lib/time";
import { parseReportParams, toCsv, type Report } from "@/lib/reports";

const report = (rows: Report["rows"]): Report => ({
  type: "sales", title: "T",
  columns: [{ key: "name", label: "Name", kind: "text" }, { key: "amount", label: "Amount", kind: "money" }],
  rows, totals: { name: "Total", amount: 3 },
});

describe("CSV export", () => {
  it("starts with a BOM and a header row, ends each line with CRLF", () => {
    const csv = toCsv(report([{ name: "Sugar", amount: 5500 }]));
    expect(csv.startsWith("﻿Name,Amount\r\n")).toBe(true);
    expect(csv).toContain("Sugar,5500\r\n");
    expect(csv.trim().split("\r\n").pop()).toBe("Total,3");
  });

  it("quotes cells containing commas, quotes and newlines", () => {
    const csv = toCsv(report([{ name: 'Rice, "premium"\nbag', amount: 1 }]));
    expect(csv).toContain('"Rice, ""premium""\nbag",1');
  });

  it("neutralises spreadsheet formula injection", () => {
    for (const evil of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)"]) {
      const cell = toCsv(report([{ name: evil, amount: 1 }])).split("\r\n")[1].split(",")[0];
      expect(cell.replace(/^"/, "").startsWith("'"), evil).toBe(true);
    }
  });
});

describe("report parameters", () => {
  const today = kampalaDateString();
  it("defaults to the last 30 days of sales", () => {
    const p = parseReportParams({});
    expect(p.type).toBe("sales");
    expect(p.toStr).toBe(today);
    expect(p.grain).toBe("day");
    expect((p.toExclusive.getTime() - p.from.getTime()) / 86400000).toBe(30);
  });
  it("falls back on unknown report types and grains", () => {
    expect(parseReportParams({ type: "../../etc/passwd", grain: "decade" })).toMatchObject({ type: "sales", grain: "day" });
  });
  it("swaps reversed dates and never reaches into the future", () => {
    const p = parseReportParams({ from: "2026-03-10", to: "2026-03-01" });
    expect([p.fromStr, p.toStr]).toEqual(["2026-03-01", "2026-03-10"]);
    expect(parseReportParams({ from: "2026-01-01", to: "2999-01-01" }).toStr).toBe(today);
  });
  it("caps very long ranges at a year", () => {
    const p = parseReportParams({ from: "2000-01-01", to: today });
    expect((p.toExclusive.getTime() - p.from.getTime()) / 86400000).toBeLessThanOrEqual(367);
  });
});
