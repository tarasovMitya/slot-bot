export type AgentName =
  | "conductor"
  | "copywriter"
  | "searcher"
  | "analyst"
  | "seo-optimizer"
  | "distribution"
  | "gsc-agent";

export interface AgentConfig {
  name: AgentName;
  displayName: string;
  token: string;
  systemPrompt: string;
}

export interface TaskMessage {
  from: AgentName;
  to: AgentName;
  taskId: string;
  action: string;
  payload: Record<string, unknown>;
}

export interface ArticleJSON {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  categorySlug: string;
  readTime: number;
  metaTitle: string;
  metaDescription: string;
  relatedServiceSlug: string;
  sections: SectionBlock[];
}

export interface SectionBlock {
  type: "p" | "h2" | "h3" | "ul" | "ol" | "tip" | "table" | "image";
  text?: string;
  items?: string[];
  rows?: Array<{ label: string; value: string }>;
  src?: string;
  alt?: string;
  caption?: string;
}

// Usernames as registered in @BotFather — update when new bots are created
export const AGENT_MENTIONS: Record<AgentName, string> = {
  conductor: "@slot_conductor_bot",
  copywriter: "@slot_copywriter_bot",
  searcher: "@slot_searcher_bot",
  analyst: "@slot_analyst_bot",
  "seo-optimizer": "@slot_seoopimizer_bot",
  distribution: "@slot_distrib_bot",
  "gsc-agent": "@slot_gsc_bot",
};
