export interface IdentityTemplate {
  id: string;
  name: string;
  description: string;
  defaultAgent: string;
  defaultAlias: string;
  skills: string[];
  /** Default sleep interval in seconds between cycles */
  sleepNormal: number;
  content: string;
}
