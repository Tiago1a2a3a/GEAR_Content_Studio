import { describe, expect, it } from "vitest";

import {
  dateSchema,
  EXPECTED_REMOTE_URL,
  remoteUrlSchema,
} from "../../src/shared/schema";

describe("schemas de entrada", () => {
  it("aceita somente datas reais em YYYY-MM-DD", () => {
    expect(dateSchema.safeParse("2024-02-29").success).toBe(true);
    expect(dateSchema.safeParse("2025-02-29").success).toBe(false);
    expect(dateSchema.safeParse("20/07/2026").success).toBe(false);
  });

  it("restringe o remoto ao Portal aprovado em HTTPS", () => {
    expect(remoteUrlSchema.safeParse(EXPECTED_REMOTE_URL).success).toBe(true);
    expect(
      remoteUrlSchema.safeParse("http://github.com/Tiago1a2a3a/Site_Gear").success,
    ).toBe(false);
    expect(remoteUrlSchema.safeParse("https://github.com/outro/repo").success).toBe(
      false,
    );
  });
});
