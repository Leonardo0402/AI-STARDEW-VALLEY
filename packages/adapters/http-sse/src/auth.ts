export type AuthHeaderProvider = Record<string, string> | (() => Promise<Record<string, string>>);

export async function resolveAuthHeaders(
  provider: AuthHeaderProvider | undefined
): Promise<Record<string, string>> {
  if (provider === undefined) return {};
  if (typeof provider === "function") {
    return await provider();
  }
  return { ...provider };
}

const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "set-cookie", "proxy-authorization"]);

export function sanitizeHeadersForLog(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(k.toLowerCase())) {
      out[k] = "<redacted>";
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function sanitizeErrorMessage(message: string, ...secrets: string[]): string {
  let result = message;
  for (const secret of secrets) {
    if (secret && result.includes(secret)) {
      result = result.split(secret).join("<redacted>");
    }
  }
  return result;
}
