import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type PortalContractLock = Readonly<{
  lockVersion: number;
  portalCommit: string;
  files: Readonly<Record<string, Readonly<{ sha256: string }>>>;
}>;

const hashFile = async (filePath: string): Promise<string> => {
  const normalizedText = (await readFile(filePath, "utf8")).replaceAll("\r\n", "\n");
  return createHash("sha256").update(normalizedText, "utf8").digest("hex");
};

export async function verifyPortalContract(
  repositoryRoot: string,
  lock: PortalContractLock,
): Promise<Readonly<{ compatible: boolean; mismatches: string[] }>> {
  const mismatches: string[] = [];
  for (const [relativePath, expected] of Object.entries(lock.files)) {
    try {
      const actual = await hashFile(path.join(repositoryRoot, relativePath));
      if (actual !== expected.sha256) mismatches.push(relativePath);
    } catch {
      mismatches.push(relativePath);
    }
  }
  return { compatible: mismatches.length === 0, mismatches };
}
