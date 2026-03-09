import type { SkillTemplate } from "../types.js";

export const skeletonUi: SkillTemplate = {
  id: "skeleton-ui",
  name: "Skeleton UI",
  description: "Svelte UI component library",
  category: "ui-components",
  content: `# Skeleton UI

You are proficient in Skeleton, a UI toolkit for Svelte + Tailwind CSS.

## Core Features

- Built for Svelte 5 and Tailwind CSS
- Accessible components
- Dark mode support
- Customizable themes

## Common Components

### App Shell

\`\`\`svelte
<script>
  import { AppShell, AppBar } from '@skeletonlabs/skeleton'
</script>

<AppShell>
  <svelte:fragment slot="header">
    <AppBar>
      <svelte:fragment slot="lead">Logo</svelte:fragment>
      <svelte:fragment slot="trail">Nav</svelte:fragment>
    </AppBar>
  </svelte:fragment>

  <svelte:fragment slot="sidebarLeft">Sidebar</svelte:fragment>

  <!-- Main content -->
  <slot />
</AppShell>
\`\`\`

### Buttons

\`\`\`svelte
<button class="btn variant-filled">Filled</button>
<button class="btn variant-filled-primary">Primary</button>
<button class="btn variant-filled-secondary">Secondary</button>
<button class="btn variant-ghost">Ghost</button>
<button class="btn variant-soft">Soft</button>
\`\`\`

### Cards

\`\`\`svelte
<div class="card p-4">
  <header class="card-header">Header</header>
  <section class="p-4">Content</section>
  <footer class="card-footer">Footer</footer>
</div>
\`\`\`

### Modals

\`\`\`svelte
<script>
  import { Modal, modalStore } from '@skeletonlabs/skeleton'

  function openModal() {
    modalStore.trigger({
      type: 'alert',
      title: 'Alert',
      body: 'This is an alert modal'
    })
  }
</script>

<Modal />
<button onclick={openModal}>Open Modal</button>
\`\`\`

### Drawers

\`\`\`svelte
<script>
  import { Drawer, drawerStore } from '@skeletonlabs/skeleton'
</script>

<Drawer>
  <h2>Drawer Content</h2>
</Drawer>

<button onclick={() => drawerStore.open()}>Open Drawer</button>
\`\`\`

### Toasts

\`\`\`svelte
<script>
  import { Toast, toastStore } from '@skeletonlabs/skeleton'

  function showToast() {
    toastStore.trigger({
      message: 'Hello World!',
      background: 'variant-filled-primary'
    })
  }
</script>

<Toast />
\`\`\`

### Tables

\`\`\`svelte
<div class="table-container">
  <table class="table table-hover">
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>John</td>
        <td>john@example.com</td>
      </tr>
    </tbody>
  </table>
</div>
\`\`\`

### Forms

\`\`\`svelte
<label class="label">
  <span>Email</span>
  <input class="input" type="email" />
</label>

<label class="label">
  <span>Message</span>
  <textarea class="textarea" rows="4"></textarea>
</label>

<label class="flex items-center space-x-2">
  <input class="checkbox" type="checkbox" />
  <span>Agree to terms</span>
</label>
\`\`\`

### Progress

\`\`\`svelte
<ProgressBar value={50} max={100} />
<ProgressRadial value={75} />
\`\`\`

## Utilities

### Gradient Headings

\`\`\`svelte
<h1 class="h1 gradient-heading">
  Gradient Text
</h1>
\`\`\`

### Avatars

\`\`\`svelte
<Avatar src="/avatar.jpg" />
<Avatar initials="JD" />
\`\`\`

### Badges

\`\`\`svelte
<span class="badge variant-filled-primary">New</span>
<span class="badge variant-soft-secondary">Beta</span>
\`\`\`

## Best Practices

- Use AppShell for consistent layouts
- Leverage variant system for theming
- Use stores for modals, drawers, toasts
- Combine with Tailwind utilities
- Follow accessibility guidelines
`,
};
