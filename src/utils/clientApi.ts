export type JsonApiResponse<T> = {
  response: Response;
  data: T;
};

type JsonErrorPayload = {
  error?: string;
};

function createTimeoutError(timeoutMs: number) {
  const seconds = Math.round(timeoutMs / 1000);

  return new Error(
    `Die Anfrage dauert l\u00e4nger als ${seconds} Sekunden. Bitte pr\u00fcfe die Verbindung und versuche es erneut.`
  );
}

export async function fetchJsonWithTimeout<T extends JsonErrorPayload = JsonErrorPayload>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 30000
): Promise<JsonApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort(createTimeoutError(timeoutMs));
  }, timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    const responseText = await response.text();
    const data = responseText
      ? (JSON.parse(responseText) as T)
      : ({} as T);

    return { response, data };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        response: new Response(null, { status: 502 }),
        data: {
          error:
            "Die Serverantwort konnte nicht gelesen werden. Bitte versuche es erneut.",
        } as T,
      };
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw createTimeoutError(timeoutMs);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
