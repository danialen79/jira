import { NextResponse } from "next/server";
import {
  AvalaiUserApiError,
  avalaiUserGet,
  type AvalaiCredit,
  type AvalaiTransactionsResponse,
  type AvalaiUsageSummary,
} from "@/lib/avalai/user-api";

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const n = Number.parseInt(raw || "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const summaryHours = clampInt(searchParams.get("summaryHours"), 24, 1, 24);
    const txHours = clampInt(searchParams.get("txHours"), 24, 1, 720);
    const pageSize = clampInt(searchParams.get("pageSize"), 40, 1, 100);
    const groupBy = searchParams.get("groupBy") || "model";

    const [credit, summary, transactions] = await Promise.all([
      avalaiUserGet<AvalaiCredit>("/credit"),
      avalaiUserGet<AvalaiUsageSummary>("/transactions/summary", {
        hours_ago: summaryHours,
        group_by: groupBy,
      }),
      avalaiUserGet<AvalaiTransactionsResponse>("/transactions", {
        hours_ago: txHours,
        page: 1,
        page_size: pageSize,
      }),
    ]);

    return NextResponse.json({
      credit,
      summary,
      transactions,
      meta: {
        summaryHours,
        txHours,
        pageSize,
        groupBy,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AvalaiUserApiError) {
      return NextResponse.json(
        { error: err.message, details: err.body },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to load AvalAI usage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
