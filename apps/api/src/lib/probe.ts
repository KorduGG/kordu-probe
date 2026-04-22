import { InvalidTargetError, ProbeTimeoutError } from "./errors";
import type { ProbeExecutionInput, ProbeExecutionResult } from "../types";

const REFUSED_PATTERNS = [/refused/i, /reset/i, /econnrefused/i];
const DISALLOWED_PATTERNS = [/cannot connect to the specified address/i, /tcp loop detected/i];

type SocketConnector = (typeof import("cloudflare:sockets"))["connect"];

function timeoutAfter(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new ProbeTimeoutError()), timeoutMs);
  });
}

async function loadSocketConnector(): Promise<SocketConnector> {
  const sockets = await import("cloudflare:sockets");
  return sockets.connect;
}

export async function probeTcpPort(input: ProbeExecutionInput): Promise<ProbeExecutionResult> {
  const connect = await loadSocketConnector();
  const socket = connect({ hostname: input.target, port: input.port });
  const startedAt = Date.now();

  try {
    await Promise.race([socket.opened, timeoutAfter(input.timeoutMs)]);

    return {
      status: "open",
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    if (error instanceof ProbeTimeoutError) {
      return {
        status: "timeout",
        latencyMs: input.timeoutMs
      };
    }

    const message = error instanceof Error ? error.message : String(error);

    if (DISALLOWED_PATTERNS.some((pattern) => pattern.test(message))) {
      throw new InvalidTargetError(
        "This target cannot be probed from Cloudflare Workers. Private ranges and Cloudflare IP ranges are blocked."
      );
    }

    if (REFUSED_PATTERNS.some((pattern) => pattern.test(message))) {
      return {
        status: "closed",
        latencyMs: Date.now() - startedAt
      };
    }

    throw error;
  } finally {
    await socket.close().catch(() => undefined);
  }
}
