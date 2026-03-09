import type { SkillTemplate } from "../types.js";

export const tailwindcss: SkillTemplate = {
  id: "tailwindcss",
  name: "Tailwind CSS",
  description: "Utility-first CSS framework",
  category: "styling",
  content: `# Tailwind CSS

You are proficient in Tailwind CSS, a utility-first CSS framework.

## Core Principles

- Use utility classes directly in HTML/JSX
- Avoid custom CSS unless absolutely necessary
- Leverage responsive modifiers (sm:, md:, lg:, xl:, 2xl:)
- Use state variants (hover:, focus:, active:, disabled:)

## Common Patterns

### Layout

\`\`\`html
<div class="flex items-center justify-between gap-4">
<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
<div class="container mx-auto px-4 py-8">
\`\`\`

### Typography

\`\`\`html
<h1 class="text-3xl font-bold text-gray-900">
<p class="text-sm text-gray-600 leading-relaxed">
\`\`\`

### Spacing

- Padding: \`p-4\`, \`px-6\`, \`py-2\`
- Margin: \`m-4\`, \`mx-auto\`, \`my-8\`
- Gap: \`gap-4\`, \`space-x-2\`, \`space-y-4\`

### Colors

- Use semantic colors: \`bg-blue-500\`, \`text-red-600\`, \`border-gray-300\`
- Dark mode: \`dark:bg-gray-800\`, \`dark:text-white\`

### Responsive Design

\`\`\`html
<div class="w-full md:w-1/2 lg:w-1/3">
<div class="text-sm md:text-base lg:text-lg">
\`\`\`

## Best Practices

- Keep classes organized: layout → spacing → colors → typography
- Use @apply sparingly in CSS files
- Leverage arbitrary values when needed: \`w-[137px]\`
- Use group and peer utilities for parent-child interactions
`,
};
