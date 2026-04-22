import skillDocuments from "./agent-skills.json";

export type AgentSkillDocument = {
  name: string;
  description: string;
  fileName: string;
};

export const agentSkillDocuments = skillDocuments as AgentSkillDocument[];
