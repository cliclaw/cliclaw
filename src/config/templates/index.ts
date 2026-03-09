export type { IdentityTemplate } from "./types.js";

import { ceo } from "./ceo/index.js";
import { cto } from "./cto/index.js";
import { staffEngineer } from "./staff-engineer/index.js";
import { typescriptDev } from "./typescript-dev/index.js";
import { goDev } from "./go-dev/index.js";
import { frontendSvelte } from "./frontend-svelte/index.js";
import { mobileFlutter } from "./mobile-flutter/index.js";
import { qaPlaywright } from "./qa-playwright/index.js";
import type { IdentityTemplate } from "./types.js";

export const IDENTITY_TEMPLATES: IdentityTemplate[] = [
  ceo, cto, staffEngineer, typescriptDev, goDev, frontendSvelte, mobileFlutter, qaPlaywright,
];

export function getTemplateContent(id: string): string | null {
  return getTemplate(id)?.content ?? null;
}

export function getTemplate(id: string): IdentityTemplate | null {
  const normalized = id.replace(/\.md$/, "");
  return IDENTITY_TEMPLATES.find(t => t.id === normalized) ?? null;
}
