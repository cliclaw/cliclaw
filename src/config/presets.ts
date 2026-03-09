import type { AgentEntry } from "../core/types.js";

export interface PresetOption {
  id: string;
  name: string;
  description: string;
  tags: string[];
  agents: AgentEntry[];
}

export const PRESET_OPTIONS: PresetOption[] = [
  {
    id: "custom",
    name: "Custom Configuration",
    description: "Manually select identities and configure each agent",
    tags: ["custom", "manual"],
    agents: [],
  },
  {
    id: "solo-developer",
    name: "Solo Developer",
    description: "Single full-stack engineer with broad responsibilities",
    tags: ["solo", "fullstack", "single", "indie"],
    agents: [
      { agent: "kiro", model: "claude-opus-4", alias: "fullstack", identity: "staff-engineer", skills: ["tailwindcss", "daisyui"], sleepNormal: 7200 },
    ],
  },
  {
    id: "go-svelte-flutter",
    name: "Go + Svelte + Flutter",
    description: "Full-stack team: Go backend, Svelte frontend, Flutter mobile",
    tags: ["go", "svelte", "flutter", "mobile", "fullstack"],
    agents: [
      { agent: "kiro", model: "claude-opus-4", alias: "ceo", identity: "ceo", sleepNormal: 86400 },
      { agent: "claude", model: "claude-sonnet-4", alias: "cto", identity: "cto", sleepNormal: 14400 },
      { agent: "kiro", model: "claude-opus-4", alias: "staff-engineer", identity: "staff-engineer", sleepNormal: 7200 },
      { agent: "claude", model: "claude-sonnet-4", alias: "go-dev", identity: "go-dev", sleepNormal: 300 },
      { agent: "kiro", model: "claude-opus-4", alias: "frontend-svelte", identity: "frontend-svelte", skills: ["tailwindcss", "daisyui", "svelte-sonner", "skeleton-ui"], sleepNormal: 300 },
      { agent: "claude", model: "claude-sonnet-4", alias: "mobile-flutter", identity: "mobile-flutter", sleepNormal: 300 },
      { agent: "cursor", model: "claude-sonnet-4", alias: "qa-playwright", identity: "qa-playwright", manual: true, sleepNormal: 3600 },
    ],
  },
  {
    id: "typescript-react-native",
    name: "TypeScript + React Native",
    description: "JavaScript-focused: TypeScript backend, React Native mobile",
    tags: ["typescript", "react", "native", "mobile", "javascript"],
    agents: [
      { agent: "kiro", model: "claude-opus-4", alias: "ceo", identity: "ceo", sleepNormal: 86400 },
      { agent: "claude", model: "claude-sonnet-4", alias: "cto", identity: "cto", sleepNormal: 14400 },
      { agent: "kiro", model: "claude-opus-4", alias: "staff-engineer", identity: "staff-engineer", sleepNormal: 7200 },
      { agent: "claude", model: "claude-sonnet-4", alias: "typescript-backend", identity: "typescript-dev", focus: "backend", sleepNormal: 300 },
      { agent: "kiro", model: "claude-opus-4", alias: "typescript-frontend", identity: "typescript-dev", focus: "frontend", skills: ["tailwindcss", "daisyui"], sleepNormal: 300 },
      { agent: "claude", model: "claude-sonnet-4", alias: "mobile-react-native", identity: "mobile-flutter", focus: "mobile", sleepNormal: 300 },
      { agent: "cursor", model: "claude-sonnet-4", alias: "qa-playwright", identity: "qa-playwright", manual: true, sleepNormal: 3600 },
    ],
  },
  {
    id: "python-django-react",
    name: "Python + Django + React",
    description: "Python backend with Django, React frontend",
    tags: ["python", "django", "react", "web", "fullstack"],
    agents: [
      { agent: "kiro", model: "claude-sonnet-4.5", alias: "ceo", identity: "ceo" },
      { agent: "codex", model: "gpt-4o", alias: "backend", identity: "staff-engineer", skills: ["django", "rest-framework"] },
      { agent: "claude", model: "claude-sonnet-4-20250514", alias: "frontend", identity: "frontend-svelte", skills: ["react", "tailwindcss"] },
      { agent: "cursor", model: "claude-sonnet-4", alias: "qa", identity: "qa-playwright" },
    ],
  },
  {
    id: "rust-nextjs",
    name: "Rust + Next.js",
    description: "High-performance Rust backend, Next.js frontend",
    tags: ["rust", "nextjs", "react", "performance", "web"],
    agents: [
      { agent: "claude", model: "claude-sonnet-4-20250514", alias: "backend", identity: "staff-engineer" },
      { agent: "kiro", model: "claude-sonnet-4.5", alias: "frontend", identity: "frontend-svelte", skills: ["nextjs", "tailwindcss"] },
    ],
  },
  {
    id: "nodejs-vue",
    name: "Node.js + Vue.js",
    description: "Node.js backend, Vue.js frontend",
    tags: ["nodejs", "vue", "javascript", "web", "fullstack"],
    agents: [
      { agent: "codex", model: "gpt-4o", alias: "backend", identity: "typescript-dev" },
      { agent: "claude", model: "claude-sonnet-4-20250514", alias: "frontend", identity: "frontend-svelte", skills: ["vue", "tailwindcss"] },
    ],
  },
  {
    id: "java-spring-angular",
    name: "Java Spring + Angular",
    description: "Enterprise Java Spring backend, Angular frontend",
    tags: ["java", "spring", "angular", "enterprise", "web"],
    agents: [
      { agent: "gemini", model: "gemini-2.0-flash-exp", alias: "backend", identity: "staff-engineer" },
      { agent: "codex", model: "gpt-4o", alias: "frontend", identity: "frontend-svelte" },
    ],
  },
  {
    id: "dotnet-blazor",
    name: ".NET + Blazor",
    description: "C# .NET backend with Blazor WebAssembly frontend",
    tags: ["dotnet", "csharp", "blazor", "web", "microsoft"],
    agents: [
      { agent: "copilot", model: "gpt-4o", alias: "fullstack", identity: "staff-engineer" },
    ],
  },
  {
    id: "elixir-phoenix-liveview",
    name: "Elixir Phoenix + LiveView",
    description: "Elixir Phoenix backend with LiveView real-time UI",
    tags: ["elixir", "phoenix", "liveview", "realtime", "web"],
    agents: [
      { agent: "claude", model: "claude-sonnet-4-20250514", alias: "fullstack", identity: "staff-engineer" },
    ],
  },
  {
    id: "rails-hotwire",
    name: "Ruby on Rails + Hotwire",
    description: "Rails backend with Hotwire (Turbo + Stimulus)",
    tags: ["ruby", "rails", "hotwire", "turbo", "web"],
    agents: [
      { agent: "kiro", model: "claude-sonnet-4.5", alias: "fullstack", identity: "staff-engineer" },
    ],
  },
];
