import { createApp } from "./app";
import { runDnsCheck } from "./lib/dns";
import { runHttpCheck } from "./lib/http";
import { runIpCheck } from "./lib/ip";
import { probeTcpPort } from "./lib/probe";
import { validateAndResolveTarget } from "./lib/targets";
import { verifyTurnstileToken } from "./lib/turnstile";

const app = createApp({
  probePort: probeTcpPort,
  verifyTurnstile: verifyTurnstileToken,
  resolveTarget: validateAndResolveTarget,
  runDnsCheck,
  runHttpCheck,
  runIpCheck
});

export default app;
