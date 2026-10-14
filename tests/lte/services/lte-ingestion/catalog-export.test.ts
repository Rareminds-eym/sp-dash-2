import { describe, it, expect, vi, afterEach } from "vitest";
import { exportCatalog } from "@/lib/services/lte-ingestion/catalog-export";
import { POST } from "@/app/api/internal/lte/catalog/route";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
afterEach(() => vi.unstubAllEnvs());
describe("catalogue export", () => {
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

  it("exports only published content and skips unscoped reads for empty dependencies", async () => {
    const chains: Record<string, any> = {};
    const from = vi.fn((table: string) => {
      const rows =
        table === "roles"
          ? [{ id: "role" }]
          : table === "role_capability_sequence"
            ? [{ id: "seq", capability_id: "cap" }]
            : table === "capabilities"
              ? [{ id: "cap" }]
              : [];
      const chain: any = {
        select: vi.fn(),
        order: vi.fn(),
        range: vi.fn(),
        in: vi.fn(),
        eq: vi.fn(),
        is: vi.fn(),
        then: (resolve: any) =>
          Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      for (const name of ["select", "order", "range", "in", "eq", "is"])
        chain[name].mockReturnValue(chain);
      chains[table] = chain;
      return chain;
    });
    const result = await exportCatalog({ from } as unknown as SupabaseClient, [
      "role",
    ]);
    expect(chains.levels.eq).toHaveBeenCalledWith("status", "published");
    expect(chains.levels.eq).toHaveBeenCalledWith("is_active", true);
    expect(from).not.toHaveBeenCalledWith("modules");
    expect(from).not.toHaveBeenCalledWith("catalog_versions");
    expect(result.tables.roles).toEqual([{ id: "role" }]);
    expect(result.tables.modules).toEqual([]);
  });
});
