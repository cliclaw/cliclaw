<script lang="ts">
  import { onMount } from 'svelte';
  import { icons } from '$lib/icons';
  
  let configAgents = $state<any[]>([]);
  let activeAgents = $state<string[]>([]);
  let messages = $state<any[]>([]);
  let tasks = $state<any[]>([]);
  let graph = $state<Record<string, string[]>>({});
  let editing = $state(false);
  let editGraph = $state<Record<string, string[]>>({});
  
  async function loadData() {
    const [configRes, activeRes, messagesRes, tasksRes, graphRes] = await Promise.all([
      fetch('/api/config/agents'),
      fetch('/api/agents'),
      fetch('/api/messages'),
      fetch('/api/tasks'),
      fetch('/api/config/graph')
    ]);
    configAgents = await configRes.json();
    activeAgents = await activeRes.json();
    messages = await messagesRes.json();
    tasks = await tasksRes.json();
    graph = await graphRes.json();
  }
  
  function getTiers(agents: any[], g: Record<string, string[]>): string[][] {
    if (!agents.length || !Object.keys(g).length) return [];
    const aliases = agents.map((a: any) => a.alias || a.agent);
    const sorted = [...aliases].sort((a: string, b: string) => (g[a]?.length || 0) - (g[b]?.length || 0));
    const tiers: string[][] = [];
    let lastCount = -1;
    for (const alias of sorted) {
      const count = g[alias]?.length || 0;
      if (count !== lastCount) { tiers.push([]); lastCount = count; }
      tiers[tiers.length - 1].push(alias);
    }
    return tiers;
  }
  
  function openEditor() {
    editGraph = JSON.parse(JSON.stringify(graph));
    editing = true;
  }
  
  function toggleConnection(from: string, to: string) {
    if (!editGraph[from]) editGraph[from] = [];
    const idx = editGraph[from].indexOf(to);
    if (idx >= 0) {
      editGraph[from] = editGraph[from].filter((t: string) => t !== to);
    } else {
      editGraph[from] = [...editGraph[from], to];
    }
  }
  
  async function saveGraph() {
    await fetch('/api/config/graph', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editGraph)
    });
    graph = editGraph;
    editing = false;
  }
  
  let tiers = $derived(getTiers(configAgents, graph));
  let allAliases = $derived(configAgents.map((a: any) => a.alias || a.agent));
  
  onMount(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  });
</script>

<div class="flex items-center justify-between mb-6">
  <h1 class="text-2xl font-bold">Agents</h1>
</div>

<!-- Communication Graph -->
{#if Object.keys(graph).length > 0}
<div class="card bg-base-200 mb-6">
  <div class="card-body">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-sm uppercase tracking-wider opacity-70 font-semibold">Communication Hierarchy</h2>
      <button class="btn btn-ghost btn-xs" onclick={openEditor}>
        {@html icons.edit} Edit
      </button>
    </div>
    <div class="flex flex-col items-center gap-2">
      {#each tiers as tier, i}
        <div class="flex flex-wrap justify-center gap-3">
          {#each tier as alias}
            {@const isActive = activeAgents.includes(alias)}
            <div class="badge badge-lg gap-2 py-3 {isActive ? 'badge-primary' : 'badge-ghost'}">
              <span class="w-2 h-2 rounded-full {isActive ? 'bg-success' : 'bg-base-content/30'}"></span>
              {alias}
            </div>
          {/each}
        </div>
        {#if i < tiers.length - 1}
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-40"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        {/if}
      {/each}
    </div>
  </div>
</div>
{/if}

<!-- Agent Cards -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {#each configAgents as agent}
    {@const isActive = activeAgents.includes(agent.alias || agent.agent)}
    {@const agentId = agent.alias || agent.agent}
    {@const targets = graph[agentId] || []}
    {@const msgCount = messages.filter((m: any) => m.from === agentId || m.to === agentId).length}
    {@const taskCount = tasks.filter((t: any) => t.agent === agentId).length}
    <div class="card bg-base-200">
      <div class="card-body p-5">
        <div class="flex items-center justify-between mb-2">
          <h2 class="card-title text-base">{agentId}</h2>
          <div class="badge {isActive ? 'badge-success' : 'badge-ghost'} badge-sm">{isActive ? 'Active' : 'Idle'}</div>
        </div>
        
        <div class="text-xs space-y-1 opacity-70">
          <div><span class="font-semibold">Type:</span> {agent.agent}</div>
          <div><span class="font-semibold">Model:</span> {agent.model || 'default'}</div>
          {#if agent.identity}
            <div><span class="font-semibold">Identity:</span> {agent.identity.split('/').pop()}</div>
          {/if}
          {#if agent.manual}
            <div class="badge badge-warning badge-xs">manual</div>
          {/if}
        </div>
        
        {#if targets.length > 0}
          <div class="mt-3 text-xs">
            <span class="opacity-50">Talks to:</span>
            <div class="flex flex-wrap gap-1 mt-1">
              {#each targets as t}
                <span class="badge badge-outline badge-xs">{t}</span>
              {/each}
            </div>
          </div>
        {/if}
        
        <div class="flex gap-4 mt-3 text-xs">
          <div><span class="font-bold text-primary">{msgCount}</span> msgs</div>
          <div><span class="font-bold text-secondary">{taskCount}</span> tasks</div>
        </div>
      </div>
    </div>
  {/each}
</div>

{#if configAgents.length === 0}
  <div class="flex flex-col items-center justify-center py-20 opacity-50">
    <div class="text-4xl mb-4">{@html icons.agents}</div>
    <p>No agents configured</p>
  </div>
{/if}

<!-- Graph Editor Modal -->
{#if editing}
<div class="modal modal-open">
  <div class="modal-box max-w-2xl">
    <h3 class="font-bold text-lg mb-4">Edit Communication Graph</h3>
    <p class="text-xs opacity-50 mb-4">Toggle which agents each agent can communicate with.</p>
    
    <div class="space-y-4">
      {#each allAliases as from}
        <div>
          <div class="font-semibold text-sm mb-2">{from} →</div>
          <div class="flex flex-wrap gap-2">
            {#each allAliases.filter((a: string) => a !== from) as to}
              {@const connected = (editGraph[from] || []).includes(to)}
              <button
                class="badge cursor-pointer {connected ? 'badge-primary' : 'badge-ghost'}"
                onclick={() => toggleConnection(from, to)}
              >{to}</button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
    
    <div class="modal-action">
      <button class="btn" onclick={() => editing = false}>Cancel</button>
      <button class="btn btn-primary" onclick={saveGraph}>Save</button>
    </div>
  </div>
</div>
{/if}
