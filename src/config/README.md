# Configuration Directory

Centralized configuration for CLIClaw's agents, models, templates, and presets.

## Files

### `models.ts`
Agent model configurations:
- `AGENT_MODELS` - Available models for each agent
- `DEFAULT_MODELS` - Default model per agent
- `AGENT_COMMANDS` - CLI command for each agent

### `templates.ts`
Identity template definitions:
- `IDENTITY_TEMPLATES` - List of available identity templates
- Each template includes: id, name, description, filename, defaultAgent, defaultAlias

### `presets.ts`
Team preset configurations:
- `PRESET_OPTIONS` - Available team presets
- Each preset includes: id, name, description, filename

### `skills.ts`
Skill template definitions:
- `SKILL_TEMPLATES` - List of available skill templates
- Each skill includes: id, name, description, filename, category

## Usage

```typescript
import { AGENT_MODELS, DEFAULT_MODELS, IDENTITY_TEMPLATES, PRESET_OPTIONS } from "../config/index.js";

// Get available models for an agent
const kiroModels = AGENT_MODELS.kiro;

// Get default model
const defaultModel = DEFAULT_MODELS.kiro;

// List identity templates
IDENTITY_TEMPLATES.forEach(t => {
  console.log(`${t.name}: ${t.description}`);
});
```

## Adding New Items

### New Model
Edit `models.ts`:
```typescript
export const AGENT_MODELS: Record<AgentName, string[]> = {
  kiro: [
    "new-model-name",  // Add here
    // ...
  ]
};
```

### New Identity Template
1. Create template file in `templates/identities/`
2. Add to `templates.ts`:
```typescript
{
  id: "new-identity",
  name: "New Identity",
  description: "Description here",
  filename: "new-identity.md",
  defaultAgent: "kiro",
  defaultAlias: "new"
}
```

### New Preset
1. Create preset JSON in `templates/presets/`
2. Add to `presets.ts`:
```typescript
{
  id: "new-preset",
  name: "New Preset",
  description: "Description here",
  filename: "new-preset.json"
}
```

### New Skill
1. Create skill file in `templates/skills/`
2. Add to `skills.ts`:
```typescript
{
  id: "new-skill",
  name: "New Skill",
  description: "Description here",
  filename: "new-skill.md",
  category: "category-name"
}
```
