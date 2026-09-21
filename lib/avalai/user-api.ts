import { getResolvedAiConfig } from "@/lib/db/repos/ai";

export const AVALAI_USER_API_BASE = "https://api.avalai.ir/user/v1";

export class AvalaiUserApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "AvalaiUserApiError";
    this.status = status;
    this.body = body;
  }
}

export function getAvalaiApiKey(): string {
  return getResolvedAiConfig("avalai").apiKey.trim();
}

export async function avalaiUserGet<T = unknown>(
  path: string,
  query?: Record<string, string | number | undefined | null>
): Promise<T> {
  const apiKey = getAvalaiApiKey();
  if (!apiKey) {
    throw new AvalaiUserApiError(
      "کلید AvalAI تنظیم نشده — در Settings ذخیره کنید.",
      400
    );
  }

  const url = new URL(
    `${AVALAI_USER_API_BASE}${path.startsWith("/") ? path : `/${path}`}`
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const msg =
      typeof body === "object" &&
      body &&
      "detail" in body &&
      typeof (body as { detail: unknown }).detail === "string"
        ? (body as { detail: string }).detail
        : typeof body === "object" &&
            body &&
            "error" in body &&
            typeof (body as { error: unknown }).error === "string"
          ? (body as { error: string }).error
          : `AvalAI User API ${res.status}`;
    throw new AvalaiUserApiError(msg, res.status, body);
  }

  return body as T;
}

export type AvalaiCredit = {
  limit?: number;
  remaining_irt?: number;
  remaining_unit?: number;
  total_unit?: number;
  exchange_rate?: number;
  account_tier?: number;
  credit_sources?: {
    grants?: AvalaiCreditPackage[];
    packages?: AvalaiCreditPackage[];
  };
};

export type AvalaiCreditPackage = {
  id?: string;
  name?: string;
  description?: string;
  amount_irt?: string;
  remaining_irt?: string;
  end_date?: string;
  allowed_services?: string[];
};

export type AvalaiUsageSummary = {
  period?: { start?: string; end?: string };
  totals?: {
    transactions?: number;
    tokens?: {
      total?: number;
      prompt?: number;
      completion?: number;
      reasoning?: number;
      cached?: number;
    };
    cost?: {
      unit?: string;
      paid_unit?: string;
      paid_irt?: string;
      paid_grant_irt?: string;
    };
  };
  by_model?: Array<{
    model?: string;
    transactions?: number;
    tokens?: number;
    cost_unit?: string;
  }> | null;
  by_provider?: Array<{
    provider?: string;
    transactions?: number;
    tokens?: number;
    cost_unit?: string;
  }> | null;
};

export type AvalaiTransaction = {
  id?: string;
  created_at?: string;
  requested_at?: string;
  model?: string;
  provider?: string;
  status_code?: number;
  stream?: boolean;
  tokens?: {
    total?: number;
    prompt?: number;
    completion?: number;
    reasoning?: number;
    cached?: number;
  };
};

export type AvalaiTransactionsResponse = {
  transactions?: AvalaiTransaction[];
  total?: number;
  page?: number;
  page_size?: number;
  has_more?: boolean;
};
