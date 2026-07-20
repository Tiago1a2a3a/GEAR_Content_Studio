import { describe, expect, it } from "vitest";

import { redact } from "../../src/shared/redaction";

describe("redaction", () => {
  it("remove credenciais e tokens", () => {
    expect(redact("https://user:password@github.com/org/repo")).not.toContain(
      "password",
    );
    expect(redact("Bearer abc.def.ghi")).toContain("[REDACTED]");
    expect(redact("ghp_123456789012345678901234567890")).toBe("[REDACTED]");
  });
});
