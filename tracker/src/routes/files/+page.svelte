<script lang="ts">
  import { onMount } from 'svelte';
  import { icons } from '$lib/icons';
  
  let files = $state<any[]>([]);
  let showFileEditor = $state(false);
  let currentFile = $state<any>(null);
  let fileContent = $state('');
  
  async function loadData() {
    const res = await fetch('/api/files');
    files = await res.json();
  }
  
  async function openFile(file: any) {
    const res = await fetch(`/api/files/read?path=${encodeURIComponent(file.fullPath)}`);
    const data = await res.json();
    fileContent = data.content;
    currentFile = file;
    showFileEditor = true;
  }
  
  async function saveFile() {
    if (!currentFile) return;
    
    await fetch('/api/files/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: currentFile.fullPath,
        content: fileContent
      })
    });
    
    showFileEditor = false;
    currentFile = null;
  }
  
  onMount(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  });
</script>

<h1 class="text-3xl font-bold mb-6">Configuration Files</h1>

{#if files.length === 0}
  <div class="flex flex-col items-center justify-center py-20">
    <div class="text-6xl opacity-50 mb-4">{@html icons.files}</div>
    <p class="text-lg opacity-70">No files found</p>
  </div>
{:else}
  <div class="space-y-2">
    {#each files as file}
      <div class="card bg-base-200 shadow hover:shadow-lg transition-shadow cursor-pointer" onclick={() => openFile(file)}>
        <div class="card-body p-4 flex-row items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="text-2xl">{@html file.type === 'json' ? icons.files : icons.edit}</div>
            <div>
              <div class="font-semibold">{file.name}</div>
              <div class="text-sm opacity-50">{file.path}</div>
            </div>
          </div>
          <div class="text-sm opacity-50">Edit →</div>
        </div>
      </div>
    {/each}
  </div>
{/if}

{#if showFileEditor}
  <div class="modal modal-open">
    <div class="modal-box max-w-4xl">
      <h3 class="font-bold text-lg mb-4">Edit {currentFile?.name}</h3>
      
      <div class="form-control mb-4">
        <label class="label">
          <span class="label-text">File Path</span>
        </label>
        <input type="text" value={currentFile?.path} class="input input-bordered" readonly />
      </div>
      
      <div class="form-control mb-4">
        <label class="label">
          <span class="label-text">Content</span>
        </label>
        <textarea class="textarea textarea-bordered font-mono h-96" bind:value={fileContent}></textarea>
      </div>
      
      <div class="modal-action">
        <button class="btn" onclick={() => showFileEditor = false}>Cancel</button>
        <button class="btn btn-primary" onclick={saveFile}>Save Changes</button>
      </div>
    </div>
  </div>
{/if}
