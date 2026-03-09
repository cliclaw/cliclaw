<script lang="ts">
  import { onMount } from 'svelte';
  import { icons } from '$lib/icons';
  
  let messages = $state<any[]>([]);
  let graph = $state<Record<string, string[]>>({});
  
  async function loadData() {
    const [msgRes, graphRes] = await Promise.all([
      fetch('/api/messages'),
      fetch('/api/config/graph')
    ]);
    messages = await msgRes.json();
    graph = await graphRes.json();
  }
  
  function isSevered(from: string, to: string): boolean {
    return !(graph[from]?.includes(to));
  }
  
  onMount(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  });
</script>

<h1 class="text-2xl font-bold mb-6">Messages</h1>

{#if messages.length === 0}
  <div class="flex flex-col items-center justify-center py-20 opacity-50">
    <div class="text-4xl mb-4">{@html icons.messages}</div>
    <p>No messages yet</p>
  </div>
{:else}
  <div class="space-y-3">
    {#each messages as msg}
      {@const severed = isSevered(msg.from, msg.to)}
      <div class="alert {severed ? 'alert-warning opacity-70' : ''}">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <div class="badge badge-primary badge-sm">{msg.from}</div>
            <span class="opacity-50">{@html icons.arrow}</span>
            <div class="badge badge-secondary badge-sm">{msg.to}</div>
            {#if severed}
              <div class="badge badge-warning badge-xs">channel severed</div>
            {/if}
            {#if msg.read}
              <div class="badge badge-success badge-xs">read</div>
            {/if}
            <span class="text-xs opacity-50 ml-auto">{new Date(msg.timestamp).toLocaleString()}</span>
          </div>
          <p class="text-sm">{msg.content}</p>
        </div>
      </div>
    {/each}
  </div>
{/if}
