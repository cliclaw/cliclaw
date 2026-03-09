import type { SkillTemplate } from "../types.js";

export const daisyui: SkillTemplate = {
  id: "daisyui",
  name: "DaisyUI",
  description: "Tailwind CSS component library",
  category: "ui-components",
  content: `# DaisyUI

You are proficient in DaisyUI, a Tailwind CSS component library.

## Core Concepts

- Built on top of Tailwind CSS
- Semantic component classes
- Theme system with CSS variables
- No JavaScript required

## Common Components

### Buttons

\`\`\`html
<button class="btn">Default</button>
<button class="btn btn-primary">Primary</button>
<button class="btn btn-secondary">Secondary</button>
<button class="btn btn-accent">Accent</button>
<button class="btn btn-ghost">Ghost</button>
<button class="btn btn-link">Link</button>
<button class="btn btn-sm">Small</button>
<button class="btn btn-lg">Large</button>
<button class="btn loading">Loading</button>
\`\`\`

### Cards

\`\`\`html
<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Card Title</h2>
    <p>Card content</p>
    <div class="card-actions justify-end">
      <button class="btn btn-primary">Action</button>
    </div>
  </div>
</div>
\`\`\`

### Forms

\`\`\`html
<input type="text" class="input input-bordered w-full" />
<textarea class="textarea textarea-bordered"></textarea>
<select class="select select-bordered">
  <option>Option 1</option>
</select>
<input type="checkbox" class="checkbox" />
<input type="radio" class="radio" />
\`\`\`

### Alerts

\`\`\`html
<div class="alert alert-info">Info message</div>
<div class="alert alert-success">Success message</div>
<div class="alert alert-warning">Warning message</div>
<div class="alert alert-error">Error message</div>
\`\`\`

### Modal

\`\`\`html
<dialog class="modal" id="my_modal">
  <div class="modal-box">
    <h3 class="font-bold text-lg">Modal Title</h3>
    <p class="py-4">Modal content</p>
    <div class="modal-action">
      <button class="btn">Close</button>
    </div>
  </div>
</dialog>
\`\`\`

### Navbar

\`\`\`html
<div class="navbar bg-base-100">
  <div class="flex-1">
    <a class="btn btn-ghost text-xl">Brand</a>
  </div>
  <div class="flex-none">
    <ul class="menu menu-horizontal px-1">
      <li><a>Link</a></li>
    </ul>
  </div>
</div>
\`\`\`

## Themes

DaisyUI includes 30+ themes. Configure in \`tailwind.config.js\`:

\`\`\`js
module.exports = {
  daisyui: {
    themes: ["light", "dark", "cupcake", "cyberpunk"],
  },
}
\`\`\`

## Best Practices

- Use semantic component classes over raw Tailwind
- Leverage theme variables for consistency
- Combine with Tailwind utilities for customization
- Use data-theme attribute for theme switching
`,
};
