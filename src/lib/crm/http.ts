import { NextResponse } from "next/server";

export function crmOkJson(payload: unknown, status = 200): NextResponse {
  return NextResponse.json(payload, { status });
}

export function crmErrorJson(error: unknown): NextResponse {
  const anyErr = error as { status?: number; message?: string; details?: unknown };
  const status = anyErr.status ?? 500;
  return NextResponse.json(
    {
      error: anyErr.message ?? "Unexpected CRM error.",
      details: anyErr.details,
    },
    { status },
  );
}
