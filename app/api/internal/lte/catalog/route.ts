import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exportCatalog } from "@/lib/services/lte-ingestion/catalog-export";

export const runtime = "nodejs";
const schema = z
  .object({ roleIds: z.array(z.string().uuid()).min(1).max(100) })
  .strict();

export async function POST(request: NextRequest) {
  const secret = process.env.LTE_CATALOG_SYNC_SECRET;
  if (!secret || secret.length < 32)
    return NextResponse.json(
      { error: "Catalogue sync is not configured" },
      { status: 503 },
    );
  const timestamp = request.headers.get("x-lte-timestamp") || "";
  const signature = request.headers.get("x-lte-signature") || "";
  if (
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(Date.now() - Number(timestamp)) > 60000 ||
    !/^[a-f0-9]{64}$/.test(signature)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.text();
  if (body.length > 16384)
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    Uint8Array.from(signature.match(/../g)!, (value) => parseInt(value, 16)),
    new TextEncoder().encode(
      `POST\n/api/internal/lte/catalog\n${timestamp}\n${body}`,
    ),
  );
  if (!valid)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let payload;
  try {
    payload = schema.parse(JSON.parse(body));
  } catch {
    return NextResponse.json({ error: "Invalid role IDs" }, { status: 400 });
  }
  try {
    const { supabaseLTE } = await import("@/lib/supabase-lte");
    const result = await exportCatalog(supabaseLTE, payload.roleIds);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("LTE catalogue export failed", error);
    return NextResponse.json(
      { error: "Managed catalogue is unavailable" },
      { status: 503 },
    );
  }
}
