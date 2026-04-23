import type { TurnstileVerification, TurnstileVerificationInput } from "../types";

type SiteVerifyResponse = {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

const DEFAULT_SITEVERIFY_TIMEOUT_MS = 2_500;
const SITEVERIFY_TIMEOUT_ERROR = "siteverify_timeout";

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === SITEVERIFY_TIMEOUT_ERROR || error.name === "AbortError" || String(error).includes("timeout"))
  );
}

async function fetchSiteverify(body: URLSearchParams, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body,
        signal: controller.signal
      }),
      new Promise<Response>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort("timeout");
          reject(new Error(SITEVERIFY_TIMEOUT_ERROR));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function verifyTurnstileToken(
  input: TurnstileVerificationInput
): Promise<TurnstileVerification> {
  const body = new URLSearchParams({
    secret: input.secretKey,
    response: input.token
  });

  if (input.remoteIp) {
    body.set("remoteip", input.remoteIp);
  }

  let response: Response;

  try {
    response = await fetchSiteverify(body, input.timeoutMs ?? DEFAULT_SITEVERIFY_TIMEOUT_MS);
  } catch (error) {
    return {
      success: false,
      errors: [isTimeoutError(error) ? SITEVERIFY_TIMEOUT_ERROR : "siteverify_failed"]
    };
  }

  if (!response.ok) {
    return {
      success: false,
      errors: [`siteverify_${response.status}`]
    };
  }

  let data: SiteVerifyResponse;

  try {
    data = await response.json();
  } catch {
    return {
      success: false,
      errors: ["siteverify_invalid_response"]
    };
  }

  const errors = [...(data["error-codes"] ?? [])];

  if (input.expectedHostname && data.hostname !== input.expectedHostname) {
    errors.push("hostname_mismatch");
  }

  if (input.expectedAction && data.action !== input.expectedAction) {
    errors.push("action_mismatch");
  }

  return {
    success: data.success && errors.length === 0,
    errors
  };
}
