<script lang="ts">
  import { onMount } from 'svelte';
  import { icons } from '$lib/icons';
  
  let messages = $state<any[]>([]);
  let tasks = $state<any[]>([]);
  let tokens = $state<any[]>([]);
  let agents = $state<any[]>([]);
  
  async function loadData() {
    const [messagesRes, tasksRes, tokensRes, agentsRes] = await Promise.all([
      fetch('/api/messages'),
      fetch('/api/tasks'),
      fetch('/api/tokens'),
      fetch('/api/agents')
    ]);
    
    messages = await messagesRes.json();
    tasks = await tasksRes.json();
    tokens = await tokensRes.json();
    agents = await agentsRes.json();
  }
  
  onMount(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  });
  
  let totalTokens = $derived(tokens.reduce((sum, t) => sum + (t.total_tokens || 0), 0));
</script>

<h1 class="text-3xl font-bold mb-6">Dashboard Overview</h1>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  <div class="stats shadow">
    <div class="stat">
      <div class="stat-figure text-primary">
        {@html icons.messages}
      </div>
      <div class="stat-title">Messages</div>
      <div class="stat-value text-primary">{messages.length}</div>
    </div>
  </div>
  
  <div class="stats shadow">
    <div class="stat">
      <div class="stat-figure text-secondary">
        {@html icons.tasks}
      </div>
      <div class="stat-title">Tasks</div>
      <div class="stat-value text-secondary">{tasks.length}</div>
    </div>
  </div>
  
  <div class="stats shadow">
    <div class="stat">
      <div class="stat-figure text-accent">
        {@html icons.tokens}
      </div>
      <div class="stat-title">Tokens</div>
      <div class="stat-value text-accent">{totalTokens.toLocaleString()}</div>
    </div>
  </div>
  
  <div class="stats shadow">
    <div class="stat">
      <div class="stat-figure text-info">
        {@html icons.agents}
      </div>
      <div class="stat-title">Agents</div>
      <div class="stat-value text-info">{agents.length}</div>
    </div>
  </div>
</div>

<div class="card bg-base-200 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Recent Activity</h2>
    
    {#if messages.length === 0}
      <div class="flex flex-col items-center justify-center py-20">
        <div class="text-6xl opacity-50 mb-4">{@html icons.dashboard}</div>
        <p class="text-lg opacity-70">No activity yet</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each messages.slice(0, 5) as msg}
          <div class="alert">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                <div class="badge badge-primary">{msg.from}</div>
                <span class="opacity-50">{@html icons.arrow}</span>
                <div class="badge badge-secondary">{msg.to}</div>
                <span class="text-sm opacity-50 ml-auto">{new Date(msg.timestamp).toLocaleString()}</span>
              </div>
              <p class="text-sm">{msg.content}</p>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
