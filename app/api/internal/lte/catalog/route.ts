import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signedLTERequest, readLTEBody, type LTEConnection } from "@/lib/lte-http";
import { lteConnection } from "@/lib/lte-api";

export const runtime = "nodejs";
const schema = z
  .object({ roleIds: z.array(z.string().uuid()).min(1).max(100) })
  .strict();

export async function POST(request: NextRequest) {
  let connection: LTEConnection;
  try {connection=await lteConnection();} catch {
    return NextResponse.json({error:'Catalogue sync is not configured'},{status:503});
  }
  const secret = connection.LTE_CATALOG_SYNC_SECRET;
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
  let body:string;
  try {body=await readLTEBody(request,16384);} catch {
    return NextResponse.json({error:'Request too large'},{status:413});
  }
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
    const result = await signedLTERequest(connection, "/api/v1/internal/catalog/export", payload);
    return new NextResponse(result.body, {status:result.status, headers:{"Content-Type":"application/json", "Cache-Control":"no-store"}});
  } catch (error) {
    console.error("LTE catalogue export failed", error);
    return NextResponse.json(
      { error: "Managed catalogue is unavailable" },
      { status: 503 },
    );
  }
}
