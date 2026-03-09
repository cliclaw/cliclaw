# Svelte Sonner

You are proficient in Svelte Sonner, a toast notification library for Svelte.

## Installation

```bash
npm install svelte-sonner
```

## Setup

```svelte
<script>
  import { Toaster } from 'svelte-sonner'
</script>

<Toaster />
```

## Basic Usage

```svelte
<script>
  import { toast } from 'svelte-sonner'
</script>

<button onclick={() => toast('Hello World')}>
  Show Toast
</button>
```

## Toast Types

```js
// Success
toast.success('Operation successful')

// Error
toast.error('Something went wrong')

// Info
toast.info('New update available')

// Warning
toast.warning('Please review your changes')

// Loading
toast.loading('Processing...')

// Promise
toast.promise(
  fetchData(),
  {
    loading: 'Loading...',
    success: 'Data loaded',
    error: 'Failed to load'
  }
)
```

## Advanced Options

```js
toast('Event created', {
  description: 'Monday, January 3rd at 6:00pm',
  duration: 5000,
  position: 'top-center',
  action: {
    label: 'Undo',
    onClick: () => console.log('Undo')
  }
})
```

## Positions

- `top-left`
- `top-center`
- `top-right`
- `bottom-left`
- `bottom-center`
- `bottom-right`

## Custom Styling

```svelte
<Toaster 
  theme="dark"
  position="top-center"
  richColors
  closeButton
/>
```

## Dismissing Toasts

```js
const toastId = toast('Processing...')
toast.dismiss(toastId)
```

## Best Practices

- Use appropriate toast types for context
- Keep messages concise and actionable
- Use promise toasts for async operations
- Provide undo actions when appropriate
- Don't overuse toasts - they can be disruptive
