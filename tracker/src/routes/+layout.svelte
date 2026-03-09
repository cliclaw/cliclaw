<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { icons } from '$lib/icons';
  
  let { children } = $props();
  let currentPath = $derived($page.url.pathname);
  
  const nav = [
    { href: '/', label: 'Overview', icon: 'dashboard' },
    { href: '/messages', label: 'Messages', icon: 'messages' },
    { href: '/tasks', label: 'Tasks', icon: 'tasks' },
    { href: '/tokens', label: 'Tokens', icon: 'tokens' },
    { href: '/agents', label: 'Agents', icon: 'agents' },
    { href: '/files', label: 'Files', icon: 'files' },
  ] as const;
</script>

<div class="drawer lg:drawer-open">
  <input id="sidebar" type="checkbox" class="drawer-toggle" />
  
  <div class="drawer-content">
    <!-- Top navbar (mobile only) -->
    <nav class="navbar bg-base-300 w-full lg:hidden">
      <div class="flex-none">
        <label for="sidebar" aria-label="open sidebar" class="btn btn-square btn-ghost">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block h-6 w-6 stroke-current">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </label>
      </div>
      <div class="mx-2 flex-1 px-2 font-bold">CLIClaw Tracker</div>
    </nav>
    
    <!-- Page content -->
    <main class="p-6 lg:p-8">
      {@render children()}
    </main>
  </div>
  
  <div class="drawer-side z-40">
    <label for="sidebar" aria-label="close sidebar" class="drawer-overlay"></label>
    <aside class="bg-base-200 min-h-full w-72 flex flex-col">
      <!-- Logo -->
      <div class="p-5 pb-2">
        <a href="/" class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-content font-bold text-lg">C</div>
          <div>
            <div class="font-bold text-lg leading-tight">CLIClaw</div>
            <div class="text-xs opacity-50">Multi-Agent Tracker</div>
          </div>
        </a>
      </div>
      
      <!-- Nav -->
      <ul class="menu px-3 py-2 flex-1 text-base-content">
        {#each nav as item}
          <li>
            <a href={item.href} class={currentPath === item.href ? 'active' : ''}>
              <span class="w-5 h-5 inline-flex items-center">{@html icons[item.icon]}</span>
              {item.label}
            </a>
          </li>
        {/each}
      </ul>
    </aside>
  </div>
</div>
