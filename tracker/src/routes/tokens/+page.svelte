<script lang="ts">
  import { onMount } from 'svelte';
  import { icons } from '$lib/icons';
  
  let tokens = $state<any[]>([]);
  
  async function loadData() {
    const res = await fetch('/api/tokens');
    tokens = await res.json();
  }
  
  onMount(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  });
</script>

<h1 class="text-3xl font-bold mb-6">Token Usage</h1>

{#if tokens.length === 0}
  <div class="flex flex-col items-center justify-center py-20">
    <div class="text-6xl opacity-50 mb-4">{@html icons.tokens}</div>
    <p class="text-lg opacity-70">No token data yet</p>
  </div>
{:else}
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {#each tokens as token}
      <div class="card bg-base-200 shadow-xl">
        <div class="card-body">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">{token.agent}</h2>
            <span class="text-xs opacity-50">{new Date(token.timestamp).toLocaleString()}</span>
          </div>
          
          <div class="stats stats-vertical shadow">
            <div class="stat py-2">
              <div class="stat-title text-xs">Input</div>
              <div class="stat-value text-xl">{token.input_tokens?.toLocaleString() || 0}</div>
            </div>
            <div class="stat py-2">
              <div class="stat-title text-xs">Output</div>
              <div class="stat-value text-xl">{token.output_tokens?.toLocaleString() || 0}</div>
            </div>
            <div class="stat py-2 bg-primary text-primary-content">
              <div class="stat-title text-xs">Total</div>
              <div class="stat-value text-2xl">{token.total_tokens?.toLocaleString() || 0}</div>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}
