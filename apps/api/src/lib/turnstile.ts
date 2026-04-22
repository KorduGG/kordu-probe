import type { TurnstileVerification, TurnstileVerificationInput } from "../types";

type SiteVerifyResponse = {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

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

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    return {
      success: false,
      errors: [`siteverify_${response.status}`]
    };
  }

  const data: SiteVerifyResponse = await response.json();
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
