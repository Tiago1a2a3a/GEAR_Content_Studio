const secretPatterns: ReadonlyArray<readonly [RegExp, string]> = [
  [/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, "$1[REDACTED]@"],
  [/([?&](?:token|access_token|password|secret)=)[^&\s]+/gi, "$1[REDACTED]"],
  [/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, "[REDACTED]"],
  [/\b(Bearer\s+)[A-Za-z0-9._~-]+/gi, "$1[REDACTED]"],
];

export function redact(value: string): string {
  return secretPatterns.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  );
}
