import { spawn } from "node:child_process";

import { redact } from "../../shared/redaction";

export type CommandResult = Readonly<{
  exitCode: number;
  stdout: string;
  stderr: string;
}>;

export async function runCommand(
  command: string,
  args: readonly string[],
  options: Readonly<{
    cwd: string;
    timeoutMs?: number;
    maxOutputBytes?: number;
    signal?: AbortSignal;
  }>,
): Promise<CommandResult> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const maxOutputBytes = options.maxOutputBytes ?? 1_048_576;
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      shell: false,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      callback();
    };
    const collect = (chunk: Buffer, stream: "stdout" | "stderr") => {
      outputBytes += chunk.byteLength;
      if (outputBytes > maxOutputBytes) {
        child.kill();
        finish(() => reject(new Error("Saída do processo excedeu o limite seguro.")));
        return;
      }
      if (stream === "stdout") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
    };
    child.stdout.on("data", (chunk: Buffer) => collect(chunk, "stdout"));
    child.stderr.on("data", (chunk: Buffer) => collect(chunk, "stderr"));
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code) =>
      finish(() =>
        resolve({
          exitCode: code ?? -1,
          stdout: redact(stdout),
          stderr: redact(stderr),
        }),
      ),
    );
    const abort = () => {
      child.kill();
      finish(() => reject(new Error("Operação cancelada.")));
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => {
      child.kill();
      finish(() => reject(new Error(`Processo excedeu ${timeoutMs} ms.`)));
    }, timeoutMs);
  });
}

export async function runGit(
  cwd: string,
  args: readonly string[],
  signal?: AbortSignal,
): Promise<CommandResult> {
  return runCommand("git", args, { cwd, signal });
}

export async function requireGit(
  cwd: string,
  args: readonly string[],
  signal?: AbortSignal,
): Promise<string> {
  const result = await runGit(cwd, args, signal);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || `git ${args[0]} falhou.`);
  }
  return result.stdout.trim();
}
