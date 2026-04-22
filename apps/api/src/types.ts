export type ProbeStatus = "open" | "closed" | "timeout";

export type CheckModule = "tcp" | "dns" | "http" | "ip" | "udp";
export type CheckModuleStatus = "ok" | "failed" | "timeout" | "unsupported";
export type TargetKind = "ip" | "domain";
export type HttpMethod = "GET" | "HEAD";
export type HttpScheme = "http" | "https";
export type RateLimitTier = "light" | "standard" | "heavy";

export type ProbeCommands = {
  curl: string;
  netcat: string;
  powershell: string;
};

export type HttpCommands = {
  curl: string;
  powershell: string;
};

export type CheckCommands = {
  tcp?: ProbeCommands;
  http?: HttpCommands;
};

export type ProbeVantage = {
  id: string;
  label: string;
  regionHint: string;
};

export type NormalizedTarget = {
  input: string;
  value: string;
  kind: TargetKind;
  hostname: string | null;
  ip: string | null;
};

export type ModuleError = {
  module: CheckModule;
  code: string;
  message: string;
  retryable?: boolean;
};

export type DnsMxRecord = {
  exchange: string;
  priority: number;
};

export type DnsRecordMap = {
  a: string[];
  aaaa: string[];
  cname: string[];
  mx: DnsMxRecord[];
  ns: string[];
  txt: string[];
};

export type DnsCheckResult = {
  status: CheckModuleStatus;
  resolver: "node:dns";
  hostname: string | null;
  reverseNames: string[];
  records: DnsRecordMap;
};

export type TcpCheckResult = {
  status: ProbeStatus;
  moduleStatus: "ok" | "timeout";
  latencyMs: number;
  explanation: string;
  port: number;
};

export type HttpRedirectHop = {
  url: string;
  statusCode: number;
  location: string | null;
};

export type HttpCheckResult = {
  status: CheckModuleStatus;
  scheme: HttpScheme;
  method: HttpMethod;
  url: string;
  finalUrl: string | null;
  statusCode: number | null;
  ok: boolean;
  latencyMs: number | null;
  redirectChain: HttpRedirectHop[];
};

export type RdapEntity = {
  handle: string | null;
  name: string | null;
  roles: string[];
};

export type RdapSummary = {
  objectClassName: string | null;
  handle: string | null;
  name: string | null;
  country: string | null;
  parentHandle: string | null;
  startAddress: string | null;
  endAddress: string | null;
  entities: RdapEntity[];
};

export type IpCheckResult = {
  status: CheckModuleStatus;
  subject: string;
  ip: string | null;
  ipVersion: "IPv4" | "IPv6" | null;
  reverseNames: string[];
  rdap: RdapSummary | null;
  source: "rdap.org+node:dns";
};

export type UnsupportedModuleResult = {
  status: "unsupported";
  reason: string;
};

export type CheckResults = {
  tcp?: TcpCheckResult;
  dns?: DnsCheckResult;
  http?: HttpCheckResult;
  ip?: IpCheckResult;
  udp?: UnsupportedModuleResult;
};

export type CheckResponse = {
  target: string;
  normalized: NormalizedTarget;
  resolvedAddresses: string[];
  vantage: ProbeVantage;
  modules: CheckModule[];
  results: CheckResults;
  errors: ModuleError[];
  commands?: CheckCommands;
};

export type ProbeResult = {
  status: ProbeStatus;
  latencyMs: number;
  target: string;
  resolvedAddress: string | null;
  explanation: string;
  commands: ProbeCommands;
  vantage: ProbeVantage;
};

export type ProbeExecutionInput = {
  target: string;
  port: number;
  timeoutMs: number;
};

export type ProbeExecutionResult = {
  status: ProbeStatus;
  latencyMs: number;
};

export type TurnstileVerification = {
  success: boolean;
  errors: string[];
};

export type TurnstileVerificationInput = {
  secretKey: string;
  token: string;
  remoteIp: string | null;
  expectedHostname?: string;
  expectedAction?: string;
};

export type RateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type AnalyticsEngineBinding = {
  writeDataPoint(data: {
    indexes?: string[];
    blobs?: string[];
    doubles?: number[];
  }): void;
};

export type AppBindings = {
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_EXPECTED_HOSTNAME?: string;
  CANONICAL_VANTAGE_ID?: string;
  CANONICAL_VANTAGE_LABEL?: string;
  CANONICAL_VANTAGE_REGION?: string;
  PROBE_RATE_LIMITER?: RateLimitBinding;
  CHECK_RATE_LIMIT_LIGHT?: RateLimitBinding;
  CHECK_RATE_LIMIT_STANDARD?: RateLimitBinding;
  CHECK_RATE_LIMIT_HEAVY?: RateLimitBinding;
  PROBE_ANALYTICS?: AnalyticsEngineBinding;
};

export type HttpRequestHint = {
  scheme?: HttpScheme;
  method?: HttpMethod;
};

export type CheckRequest = {
  target: string;
  port?: number;
  modules?: CheckModule[];
  timeoutMs?: number;
  http?: HttpRequestHint;
  turnstileToken?: string;
};

export type ResolvedTarget = {
  input: string;
  normalizedTarget: string;
  targetKind: TargetKind;
  hostname: string | null;
  ip: string | null;
  resolvedAddresses: string[];
  primaryAddress: string | null;
};
