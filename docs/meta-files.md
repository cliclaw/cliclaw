# Meta Files

CLIClaw builds prompts from meta files in priority order. These files define the agent's context, identity, and constraints.

## File Priority

| Priority | File                          | Purpose                                  |
|----------|-------------------------------|------------------------------------------|
| 1        | `.cliclaw/memory/MEMORY.md`   | Persistent learned patterns and insights |
| 2        | `.cliclaw/meta/you.md`        | Who you are, your role and tech stack    |
| 3        | `.cliclaw/meta/projects.md`   | Active projects and priorities           |
| 4        | `.cliclaw/meta/boundaries.md` | Hard rules the agent must never violate  |
| 5        | `.cliclaw/meta/identity.md`   | Agent identity: name, role, mission      |
| 6        | `.cliclaw/meta/tools.md`      | Available tools and CLI commands         |
| 7        | `.cliclaw/meta/boot.md`       | Startup instructions — cycle 1 only      |

These are created by `cliclaw setup` and `cliclaw identity`. The prompt builder strips template boilerplate, empty placeholders, and HTML comments before composing the final prompt.

## Prompt Builder

The prompt builder (`src/prompts/builder.ts`) composes a single prompt each cycle:

- Reads all meta files in priority order
- Cleans content: strips `#` title headers, `<!-- -->` comments, empty `- **Key**:` fields, boilerplate descriptions
- Demotes `##` to `###` in meta content to avoid header clashes
- Skips sections that contain only template content (no user data)
- Filters template rules from memory snippets
- Applies token budget — truncates if the composed prompt exceeds the limit
- Computes a hash for prompt diffing — skips sending if identical to last cycle
- Runs secret scanning before sending to the agent

## Boundaries

`.cliclaw/meta/boundaries.md` is the primary safety mechanism for constraining agent behavior. It is injected into every prompt and should be treated as non-negotiable rules.

### What to put in boundaries.md

Effective boundaries are **specific, unambiguous, and cover the blast radius** of autonomous operation. The generated template covers:

**Git & version control**

- No direct pushes to protected branches (`main`, `master`)
- No force-pushes to any remote
- No committing secrets or credentials
- No amending/rebasing already-pushed commits

**Destructive operations**

- No `DROP TABLE` / `TRUNCATE` / unscoped `DELETE` on production databases
- No deleting files outside the project root
- No `git clean -fdx` without explicit confirmation
- No modifying `.env` or secrets files

**Security**

- No hardcoded secrets in source code
- No disabling SSL/TLS verification
- No exposing services to `0.0.0.0` without instruction
- No installing packages from untrusted registries

**Scope**

- No modifying files outside the project root
- No touching CI/CD configs or IaC without explicit instruction

**Ambiguity resolution**

- If an instruction conflicts with a boundary, the boundary wins
- Agent should output `[EXIT CLICLAW]` and explain why

### Token budget

The default `promptBudgets.boundaries` is `200` tokens (~800 chars). If your boundaries file is longer, increase this in `.cliclaw/config.json`:

```json
{ "promptBudgets": { "boundaries": 500 } }
```

Silently truncated boundaries are worse than no boundaries — size the budget to fit your rules.

### Customizing for your project

Add project-specific rules after the generated template:

```markdown
## Project-Specific Rules
- NEVER modify the `payments/` directory — it requires a separate review process
- NEVER change database migration files that have already been applied
- NEVER remove feature flags without a corresponding ticket reference
```
