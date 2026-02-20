export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: string }).error)
        : `Request failed (${response.status})`;
    const details =
      typeof payload === "object" && payload && "details" in payload
        ? (payload as { details?: unknown }).details
        : undefined;
    const detailsMessage = getErrorDetailsMessage(details);
    throw new Error(detailsMessage ? `${errorMessage}: ${detailsMessage}` : errorMessage);
  }

  return payload as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorDetailsMessage(details: unknown): string | null {
  if (typeof details === "string" && details.trim().length > 0) {
    return details.trim();
  }

  if (Array.isArray(details)) {
    const firstString = details.find(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
    if (firstString) {
      return firstString.trim();
    }
  }

  if (typeof details !== "object" || details === null) {
    return null;
  }

  const message = (details as { message?: unknown }).message;
  if (typeof message === "string" && message.trim().length > 0) {
    return message.trim();
  }

  if (Array.isArray(message)) {
    const firstString = message.find(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
    if (firstString) {
      return firstString.trim();
    }
  }

  return null;
}
