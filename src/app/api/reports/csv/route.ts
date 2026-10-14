import { can } from "@/lib/permissions";
import { buildReport, parseReportParams, toCsv } from "@/lib/reports";
import { getUser } from "@/lib/session";

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!can(user.role, "reports.view")) return new Response("Forbidden", { status: 403 });

  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const params = parseReportParams(sp);
  const report = await buildReport(params);
  const name = `${params.type}-${params.fromStr}_to_${params.toStr}.csv`;
  return new Response(toCsv(report), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
