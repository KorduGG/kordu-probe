import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sharedModulePath = path.join(projectRoot, "packages", "shared", "src", "agent-skills.json");
const publicSkillsDir = path.join(projectRoot, "apps", "web", "public", ".well-known", "agent-skills");
const outputPath = path.join(publicSkillsDir, "index.json");
const siteUrl = (process.env.SITE_URL ?? "https://probe.kordu.tools").replace(/\/$/, "");

const agentSkillDocuments = JSON.parse(await fs.readFile(sharedModulePath, "utf8"));

const skills = await Promise.all(
  agentSkillDocuments.map(async (skill) => {
    const skillPath = path.join(publicSkillsDir, skill.fileName);
    const file = await fs.readFile(skillPath);
    const digest = createHash("sha256").update(file).digest("hex");

    return {
      name: skill.name,
      type: "skill-md",
      description: skill.description,
      url: `${siteUrl}/.well-known/agent-skills/${skill.fileName}`,
      digest: `sha256:${digest}`
    };
  })
);

const payload = {
  $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  skills
};

await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
