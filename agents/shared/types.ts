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

export const AGENT_MENTIONS: Record<AgentName, string> = {
  conductor: "@seo_conductor_bot",
  copywriter: "@seo_copywriter_bot",
  searcher: "@seo_searcher_bot",
  analyst: "@seo_analyst_bot",
  "seo-optimizer": "@seo_optimizer_bot",
  distribution: "@seo_dist_bot",
  "gsc-agent": "@seo_gsc_bot",
};
