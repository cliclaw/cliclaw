export type { SkillTemplate } from "./types.js";

import { tailwindcss } from "./tailwindcss/index.js";
import { daisyui } from "./daisyui/index.js";
import { skeletonUi } from "./skeleton-ui/index.js";
import { svelteSonner } from "./svelte-sonner/index.js";
import type { SkillTemplate } from "./types.js";

export const SKILL_TEMPLATES: SkillTemplate[] = [
  tailwindcss, daisyui, skeletonUi, svelteSonner,
];

export function getSkillContent(id: string): string | null {
  return SKILL_TEMPLATES.find(s => s.id === id)?.content ?? null;
}
