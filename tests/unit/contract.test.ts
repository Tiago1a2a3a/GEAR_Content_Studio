import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  verifyPortalContract,
  type PortalContractLock,
} from "../../src/main/validation/contract";

describe("assinatura do contrato", () => {
  it("trata LF e CRLF como o mesmo texto sem alterar o arquivo", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gear-contract-"));
    const contents = "linha 1\nlinha 2\n";
    await writeFile(path.join(root, "contract.ts"), contents.replaceAll("\n", "\r\n"));
    const lock: PortalContractLock = {
      lockVersion: 1,
      portalCommit: "fixture",
      files: {
        "contract.ts": {
          sha256: createHash("sha256").update(contents, "utf8").digest("hex"),
        },
      },
    };

    await expect(verifyPortalContract(root, lock)).resolves.toEqual({
      compatible: true,
      mismatches: [],
    });
  });
});
