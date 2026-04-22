export type PortGuide = {
  port: number;
  slug: string;
  name: string;
  service: string;
  summary: string;
  commonUses: string[];
};

export const curatedPorts: PortGuide[] = [
  {
    port: 22,
    slug: "ssh",
    name: "Port 22",
    service: "SSH",
    summary: "Used for secure shell access, Git over SSH, and remote Linux administration.",
    commonUses: ["Remote shell", "Git deploy keys", "Bastion hosts"]
  },
  {
    port: 80,
    slug: "http",
    name: "Port 80",
    service: "HTTP",
    summary: "Common for public web traffic and redirect-only front doors.",
    commonUses: ["Web servers", "Load balancers", "HTTP to HTTPS redirects"]
  },
  {
    port: 443,
    slug: "https",
    name: "Port 443",
    service: "HTTPS",
    summary: "The default encrypted web port for sites, APIs, and reverse proxies.",
    commonUses: ["TLS web apps", "APIs", "CDN front doors"]
  },
  {
    port: 25565,
    slug: "minecraft",
    name: "Port 25565",
    service: "Minecraft",
    summary: "The default Java edition Minecraft server port and a major user-intent keyword.",
    commonUses: ["Minecraft Java", "Home lab game servers", "Hosted communities"]
  },
  {
    port: 3389,
    slug: "rdp",
    name: "Port 3389",
    service: "Remote Desktop",
    summary: "Typically used for Windows Remote Desktop and often blocked for safety.",
    commonUses: ["Windows administration", "Jump boxes", "Remote support"]
  }
];

export const commonPortLookup = new Map(curatedPorts.map((entry) => [entry.port, entry]));

