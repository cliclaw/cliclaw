<script lang="ts">
  import { onMount } from 'svelte';
  import { icons } from '$lib/icons';
  
  let tasks = $state<any[]>([]);
  
  async function loadData() {
    const res = await fetch('/api/tasks');
    tasks = await res.json();
  }
  
  onMount(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  });
  
  function getTasksByStatus(status: string) {
    return tasks.filter(t => t.status === status);
  }
</script>

<h1 class="text-3xl font-bold mb-6">Task Board</h1>

{#if tasks.length === 0}
  <div class="flex flex-col items-center justify-center py-20">
    <div class="text-6xl opacity-50 mb-4">{@html icons.tasks}</div>
    <p class="text-lg opacity-70">No tasks yet</p>
  </div>
{:else}
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <div>
      <div class="badge badge-primary badge-lg w-full mb-3">To Do ({getTasksByStatus('todo').length})</div>
      <div class="space-y-2">
        {#each getTasksByStatus('todo') as task}
          <div class="card bg-base-200 shadow">
            <div class="card-body p-4">
              <div class="badge badge-primary badge-sm">{task.agent}</div>
              <p class="font-medium">{task.title || task.task_id}</p>
              <p class="text-xs opacity-50">{new Date(task.timestamp).toLocaleString()}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
    
    <div>
      <div class="badge badge-warning badge-lg w-full mb-3">In Progress ({getTasksByStatus('in_progress').length})</div>
      <div class="space-y-2">
        {#each getTasksByStatus('in_progress') as task}
          <div class="card bg-base-200 shadow">
            <div class="card-body p-4">
              <div class="badge badge-warning badge-sm">{task.agent}</div>
              <p class="font-medium">{task.title || task.task_id}</p>
              <p class="text-xs opacity-50">{new Date(task.timestamp).toLocaleString()}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
    
    <div>
      <div class="badge badge-success badge-lg w-full mb-3">Done ({getTasksByStatus('done').length})</div>
      <div class="space-y-2">
        {#each getTasksByStatus('done') as task}
          <div class="card bg-base-200 shadow">
            <div class="card-body p-4">
              <div class="badge badge-success badge-sm">{task.agent}</div>
              <p class="font-medium">{task.title || task.task_id}</p>
              <p class="text-xs opacity-50">{new Date(task.timestamp).toLocaleString()}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
    
    <div>
      <div class="badge badge-error badge-lg w-full mb-3">Blocked ({getTasksByStatus('blocked').length})</div>
      <div class="space-y-2">
        {#each getTasksByStatus('blocked') as task}
          <div class="card bg-base-200 shadow">
            <div class="card-body p-4">
              <div class="badge badge-error badge-sm">{task.agent}</div>
              <p class="font-medium">{task.title || task.task_id}</p>
              <p class="text-xs opacity-50">{new Date(task.timestamp).toLocaleString()}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}
