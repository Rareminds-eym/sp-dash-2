import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {getCloudflareContext} from '@opennextjs/cloudflare';
import { POST } from "@/app/api/internal/lte/catalog/route";
import { NextRequest } from "next/server";
vi.mock('@opennextjs/cloudflare',()=>({getCloudflareContext:vi.fn()}));
const secret='test-secret-longer-than-thirty-two-characters';
beforeEach(()=>vi.mocked(getCloudflareContext).mockResolvedValue({env:{LTE_API_BASE_URL:'https://lte.example.com',LTE_CATALOG_SYNC_SECRET:secret}} as never));
afterEach(() => {vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("catalogue export", () => {
  it('reads the recovery secret from Worker bindings and streams a signed LTE export',async()=>{
    vi.stubEnv('LTE_CATALOG_SYNC_SECRET','wrong-process-secret');
    const timestamp=String(Date.now());const body=JSON.stringify({roleIds:['11111111-1111-4111-8111-111111111111']});
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`POST\n/api/internal/lte/catalog\n${timestamp}\n${body}`)));
    const signature=[...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    const upstream=vi.fn(async(_input:RequestInfo|URL,_init?:RequestInit)=>Response.json({version:1,tables:{roles:[]}}));vi.stubGlobal('fetch',upstream);
    const response=await POST(new NextRequest('https://dash.example.com/api/internal/lte/catalog',{method:'POST',body,headers:{'x-lte-timestamp':timestamp,'x-lte-signature':signature}}));
    expect(response.status).toBe(200);expect(await response.json()).toEqual({version:1,tables:{roles:[]}});
    expect(String(upstream.mock.calls[0]?.[0])).toBe('https://lte.example.com/api/v1/internal/catalog/export');
  });
  it("rejects unsigned and expired requests before database access", async () => {
    vi.stubEnv(
      "LTE_CATALOG_SYNC_SECRET",
      "test-secret-longer-than-thirty-two-characters",
    );
    expect(
      (
        await POST(
          new NextRequest("http://localhost/api/internal/lte/catalog", {
            method: "POST",
            body: "{}",
          }),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await POST(
          new NextRequest("http://localhost/api/internal/lte/catalog", {
            method: "POST",
            body: "{}",
            headers: {
              "x-lte-timestamp": "1000000000000",
              "x-lte-signature": "a".repeat(64),
            },
          }),
        )
      ).status,
    ).toBe(401);
  });
  it("rejects a signature when its request body has been changed", async () => {
    const secret = "test-secret-longer-than-thirty-two-characters";
    vi.stubEnv("LTE_CATALOG_SYNC_SECRET", secret);
    const timestamp = String(Date.now());
    const body = JSON.stringify({
      roleIds: ["11111111-1111-4111-8111-111111111111"],
    });
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signed = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(
        `POST\n/api/internal/lte/catalog\n${timestamp}\n${body}`,
      ),
    );
    const signature = Array.from(new Uint8Array(signed), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const response = await POST(
      new NextRequest("http://localhost/api/internal/lte/catalog", {
        method: "POST",
        body: body + " ",
        headers: { "x-lte-timestamp": timestamp, "x-lte-signature": signature },
      }),
    );
    expect(response.status).toBe(401);
  });

});
