const moduleEnum = ["tcp", "dns", "http", "ip", "udp"] as const;

const checkRequestSchema = {
  type: "object",
  required: ["target"],
  properties: {
    target: { type: "string", description: "Public hostname or IP address to inspect." },
    port: { type: "integer", minimum: 1, maximum: 65535 },
    modules: {
      type: "array",
      items: {
        type: "string",
        enum: moduleEnum
      }
    },
    timeoutMs: { type: "integer", minimum: 250, maximum: 10000, default: 3000 },
    http: {
      type: "object",
      properties: {
        scheme: { type: "string", enum: ["http", "https"] },
        method: { type: "string", enum: ["HEAD", "GET"] }
      }
    }
  }
};

const probeCompatibilitySchema = {
  type: "object",
  required: ["target", "port"],
  properties: {
    target: { type: "string", description: "Public hostname or IP address to test." },
    port: { type: "integer", minimum: 1, maximum: 65535 },
    timeoutMs: { type: "integer", minimum: 250, maximum: 10000, default: 3000 }
  }
};

const responseViewParam = {
  name: "view",
  in: "query",
  description: "Response shape. Defaults to `minimal`; use `full` for the rich diagnostic envelope.",
  schema: {
    type: "string",
    enum: ["minimal", "full"],
    default: "minimal"
  }
};

const responseFormatParam = {
  name: "format",
  in: "query",
  description: "Output encoding for minimal responses. `plain` and `boolean` only support single-module checks.",
  schema: {
    type: "string",
    enum: ["json", "plain", "boolean"],
    default: "json"
  }
};

const preferHeaderParam = {
  name: "Prefer",
  in: "header",
  description: "Optional HTTP preference. `return=representation` requests the full response envelope.",
  schema: {
    type: "string"
  }
};

const minimalCheckResponseSchema = {
  type: "object",
  required: ["ok", "target"],
  properties: {
    ok: { type: "boolean" },
    target: { type: "string" },
    module: { type: "string", enum: moduleEnum },
    status: { type: "string" },
    latencyMs: { type: "integer", nullable: true },
    port: { type: "integer", nullable: true },
    ip: { type: "string", nullable: true },
    url: { type: "string", nullable: true },
    statusCode: { type: "integer", nullable: true },
    records: { type: "integer", nullable: true },
    ipVersion: { type: "string", enum: ["IPv4", "IPv6"], nullable: true },
    reason: { type: "string", nullable: true },
    checks: {
      type: "object",
      additionalProperties: {
        type: "string",
        nullable: true
      }
    }
  }
};

const checkResponseSchema = {
  type: "object",
  required: ["target", "normalized", "resolvedAddresses", "vantage", "modules", "results", "errors"],
  properties: {
    target: { type: "string" },
    normalized: {
      type: "object",
      required: ["input", "value", "kind", "hostname", "ip"],
      properties: {
        input: { type: "string" },
        value: { type: "string" },
        kind: { type: "string", enum: ["ip", "domain"] },
        hostname: { type: "string", nullable: true },
        ip: { type: "string", nullable: true }
      }
    },
    resolvedAddresses: {
      type: "array",
      items: { type: "string" }
    },
    vantage: {
      type: "object",
      required: ["id", "label", "regionHint"],
      properties: {
        id: { type: "string" },
        label: { type: "string" },
        regionHint: { type: "string" }
      }
    },
    modules: {
      type: "array",
      items: { type: "string", enum: moduleEnum }
    },
    results: {
      type: "object",
      properties: {
        tcp: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["open", "closed", "timeout"] },
            moduleStatus: { type: "string", enum: ["ok", "timeout"] },
            latencyMs: { type: "integer", minimum: 0 },
            explanation: { type: "string" },
            port: { type: "integer" }
          }
        },
        dns: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["ok", "failed", "timeout", "unsupported"] },
            resolver: { type: "string" },
            hostname: { type: "string", nullable: true },
            reverseNames: { type: "array", items: { type: "string" } },
            records: {
              type: "object",
              properties: {
                a: { type: "array", items: { type: "string" } },
                aaaa: { type: "array", items: { type: "string" } },
                cname: { type: "array", items: { type: "string" } },
                mx: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      exchange: { type: "string" },
                      priority: { type: "integer" }
                    }
                  }
                },
                ns: { type: "array", items: { type: "string" } },
                txt: { type: "array", items: { type: "string" } }
              }
            }
          }
        },
        http: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["ok", "failed", "timeout", "unsupported"] },
            scheme: { type: "string", enum: ["http", "https"] },
            method: { type: "string", enum: ["HEAD", "GET"] },
            url: { type: "string" },
            finalUrl: { type: "string", nullable: true },
            statusCode: { type: "integer", nullable: true },
            ok: { type: "boolean" },
            latencyMs: { type: "integer", nullable: true },
            redirectChain: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: { type: "string" },
                  statusCode: { type: "integer" },
                  location: { type: "string", nullable: true }
                }
              }
            }
          }
        },
        ip: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["ok", "failed", "timeout", "unsupported"] },
            subject: { type: "string" },
            ip: { type: "string", nullable: true },
            ipVersion: { type: "string", enum: ["IPv4", "IPv6"], nullable: true },
            reverseNames: { type: "array", items: { type: "string" } },
            source: { type: "string" },
            rdap: {
              type: "object",
              nullable: true,
              properties: {
                objectClassName: { type: "string", nullable: true },
                handle: { type: "string", nullable: true },
                name: { type: "string", nullable: true },
                country: { type: "string", nullable: true },
                parentHandle: { type: "string", nullable: true },
                startAddress: { type: "string", nullable: true },
                endAddress: { type: "string", nullable: true }
              }
            }
          }
        },
        udp: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["unsupported"] },
            reason: { type: "string" }
          }
        }
      }
    },
    errors: {
      type: "array",
      items: {
        type: "object",
        required: ["module", "code", "message"],
        properties: {
          module: { type: "string", enum: moduleEnum },
          code: { type: "string" },
          message: { type: "string" },
          retryable: { type: "boolean" }
        }
      }
    },
    commands: {
      type: "object",
      properties: {
        tcp: {
          type: "object",
          properties: {
            curl: { type: "string" },
            netcat: { type: "string" },
            powershell: { type: "string" }
          }
        },
        http: {
          type: "object",
          properties: {
            curl: { type: "string" },
            powershell: { type: "string" }
          }
        }
      }
    }
  }
};

const probeResponseSchema = {
  type: "object",
  required: ["status", "latencyMs", "target", "vantage", "explanation", "commands"],
  properties: {
    status: { type: "string", enum: ["open", "closed", "timeout"] },
    latencyMs: { type: "integer", minimum: 0 },
    target: { type: "string" },
    resolvedAddress: { type: "string", nullable: true },
    explanation: { type: "string" },
    commands: {
      type: "object",
      required: ["curl", "netcat", "powershell"],
      properties: {
        curl: { type: "string" },
        netcat: { type: "string" },
        powershell: { type: "string" }
      }
    },
    vantage: {
      type: "object",
      required: ["id", "label", "regionHint"],
      properties: {
        id: { type: "string" },
        label: { type: "string" },
        regionHint: { type: "string" }
      }
    }
  }
};

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Kordu Probe API",
    version: "0.2.0",
    description:
      "Anonymous public connectivity checks from a canonical Cloudflare Workers vantage, with modular TCP, DNS, HTTP/HTTPS, and IP/domain diagnostics."
  },
  paths: {
    "/api/health": {
      get: {
        summary: "Health endpoint",
        responses: {
          "200": {
            description: "API is healthy"
          }
        }
      }
    },
    "/api/openapi.json": {
      get: {
        summary: "OpenAPI document",
        responses: {
          "200": {
            description: "Machine-readable API schema"
          }
        }
      }
    },
    "/api/check": {
      post: {
        summary: "Run a connectivity check",
        parameters: [responseViewParam, responseFormatParam, preferHeaderParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: checkRequestSchema
            }
          }
        },
        responses: {
          "200": {
            description: "Connectivity check completed",
            content: {
              "application/json": {
                schema: {
                  oneOf: [minimalCheckResponseSchema, checkResponseSchema]
                }
              },
              "text/plain": {
                schema: {
                  type: "string"
                }
              }
            }
          },
          "400": { description: "Invalid target or malformed request" },
          "429": { description: "Rate-limited" }
        }
      }
    },
    "/api/probe": {
      post: {
        summary: "Compatibility TCP probe alias",
        parameters: [responseViewParam, responseFormatParam, preferHeaderParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: probeCompatibilitySchema
            }
          }
        },
        responses: {
          "200": {
            description: "TCP probe completed",
            content: {
              "application/json": {
                schema: {
                  oneOf: [minimalCheckResponseSchema, probeResponseSchema]
                }
              },
              "text/plain": {
                schema: {
                  type: "string"
                }
              }
            }
          },
          "400": { description: "Invalid target or malformed request" },
          "429": { description: "Rate-limited" }
        }
      }
    }
  }
} as const;
