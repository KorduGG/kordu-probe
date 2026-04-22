import { formatHostForUrl } from "./targets";
import type { HttpCommands, HttpMethod, HttpScheme, ProbeCommands } from "../types";

export function buildProbeCommands(target: string, port: number): ProbeCommands {
  const urlHost = formatHostForUrl(target);

  return {
    curl: `curl --connect-timeout 5 telnet://${urlHost}:${port}`,
    netcat: `nc -vz ${target} ${port}`,
    powershell: `Test-NetConnection -ComputerName ${target} -Port ${port}`
  };
}

export function buildHttpCommands(
  target: string,
  port: number | undefined,
  scheme: HttpScheme,
  method: HttpMethod
): HttpCommands {
  const host = formatHostForUrl(target);
  const defaultPort = scheme === "https" ? 443 : 80;
  const portSuffix = port && port !== defaultPort ? `:${port}` : "";
  const url = `${scheme}://${host}${portSuffix}/`;

  return {
    curl: `curl -X ${method} -i ${url}`,
    powershell: `Invoke-WebRequest -Uri '${url}' -Method ${method}`
  };
}
