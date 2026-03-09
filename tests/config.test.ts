import { describe, it, expect } from "vitest";
import { PRESET_OPTIONS } from "../src/config/presets.js";
import { IDENTITY_TEMPLATES } from "../src/config/templates/index.js";
import { AGENT_MODELS, DEFAULT_MODELS, AGENT_COMMANDS } from "../src/config/models.js";
import { SKILL_TEMPLATES } from "../src/config/skills/index.js";
import { ALL_AGENTS } from "../src/core/config.js";

describe("Configuration", () => {
  describe("Presets", () => {
    it("should have at least 10 preset options", () => {
      expect(PRESET_OPTIONS.length).toBeGreaterThanOrEqual(10);
    });

    it("should have custom preset as first option", () => {
      expect(PRESET_OPTIONS[0].id).toBe("custom");
    });

    it("should have unique preset IDs", () => {
      const ids = PRESET_OPTIONS.map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should have tags for all presets", () => {
      PRESET_OPTIONS.forEach(preset => {
        expect(preset.tags).toBeDefined();
        expect(Array.isArray(preset.tags)).toBe(true);
        expect(preset.tags.length).toBeGreaterThan(0);
      });
    });

    it("should have searchable tags", () => {
      const allTags = PRESET_OPTIONS.flatMap(p => p.tags);
      expect(allTags).toContain("python");
      expect(allTags).toContain("rust");
      expect(allTags).toContain("typescript");
      expect(allTags).toContain("go");
    });

    it("should have common stacks", () => {
      const presetIds = PRESET_OPTIONS.map(p => p.id);
      expect(presetIds).toContain("python-django-react");
      expect(presetIds).toContain("rust-nextjs");
      expect(presetIds).toContain("nodejs-vue");
      expect(presetIds).toContain("java-spring-angular");
      expect(presetIds).toContain("dotnet-blazor");
      expect(presetIds).toContain("elixir-phoenix-liveview");
      expect(presetIds).toContain("rails-hotwire");
    });
  });

  describe("Identity Templates", () => {
    it("should have at least 8 identity templates", () => {
      expect(IDENTITY_TEMPLATES.length).toBeGreaterThanOrEqual(8);
    });

    it("should have unique template IDs", () => {
      const ids = IDENTITY_TEMPLATES.map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should have valid default agents", () => {
      IDENTITY_TEMPLATES.forEach(template => {
        expect(ALL_AGENTS).toContain(template.defaultAgent);
      });
    });

    it("should have default aliases", () => {
      IDENTITY_TEMPLATES.forEach(template => {
        expect(template.defaultAlias).toBeDefined();
        expect(template.defaultAlias.length).toBeGreaterThan(0);
      });
    });

    it("should have content embedded", () => {
      IDENTITY_TEMPLATES.forEach(template => {
        expect(template.content).toBeDefined();
        expect(template.content.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Agent Models", () => {
    it("should have models for all agents", () => {
      ALL_AGENTS.forEach(agent => {
        expect(AGENT_MODELS[agent]).toBeDefined();
        expect(Array.isArray(AGENT_MODELS[agent])).toBe(true);
        expect(AGENT_MODELS[agent].length).toBeGreaterThan(0);
      });
    });

    it("should have default models for all agents", () => {
      ALL_AGENTS.forEach(agent => {
        expect(DEFAULT_MODELS[agent]).toBeDefined();
        expect(typeof DEFAULT_MODELS[agent]).toBe("string");
      });
    });

    it("should have default model in available models", () => {
      ALL_AGENTS.forEach(agent => {
        const defaultModel = DEFAULT_MODELS[agent];
        const availableModels = AGENT_MODELS[agent];
        expect(availableModels).toContain(defaultModel);
      });
    });

    it("should have kiro with latest Claude models", () => {
      expect(AGENT_MODELS.kiro).toContain("claude-opus-4.6");
      expect(AGENT_MODELS.kiro).toContain("claude-sonnet-4.6");
      expect(AGENT_MODELS.kiro).toContain("claude-sonnet-4.5");
    });

    it("should have commands for all agents", () => {
      ALL_AGENTS.forEach(agent => {
        expect(AGENT_COMMANDS[agent]).toBeDefined();
        expect(typeof AGENT_COMMANDS[agent]).toBe("string");
      });
    });
  });

  describe("Skills", () => {
    it("should have at least 4 skill templates", () => {
      expect(SKILL_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    });

    it("should have unique skill IDs", () => {
      const ids = SKILL_TEMPLATES.map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should have categories", () => {
      SKILL_TEMPLATES.forEach(skill => {
        expect(skill.category).toBeDefined();
        expect(typeof skill.category).toBe("string");
      });
    });

    it("should have content embedded", () => {
      SKILL_TEMPLATES.forEach(skill => {
        expect(skill.content).toBeDefined();
        expect(skill.content.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Search Functionality", () => {
    it("should find presets by name", () => {
      const searchTerm = "python";
      const results = PRESET_OPTIONS.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        p.tags.some(t => t.includes(searchTerm))
      );
      expect(results.length).toBeGreaterThan(0);
    });

    it("should find presets by tag", () => {
      const searchTerm = "mobile";
      const results = PRESET_OPTIONS.filter(p => 
        p.tags.includes(searchTerm)
      );
      expect(results.length).toBeGreaterThan(0);
    });

    it("should find presets by description", () => {
      const searchTerm = "backend";
      const results = PRESET_OPTIONS.filter(p => 
        p.description.toLowerCase().includes(searchTerm)
      );
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("Integration", () => {
    it("should have consistent agent names across configs", () => {
      const modelAgents = Object.keys(AGENT_MODELS);
      const defaultModelAgents = Object.keys(DEFAULT_MODELS);
      const commandAgents = Object.keys(AGENT_COMMANDS);
      
      expect(modelAgents.sort()).toEqual(ALL_AGENTS.sort());
      expect(defaultModelAgents.sort()).toEqual(ALL_AGENTS.sort());
      expect(commandAgents.sort()).toEqual(ALL_AGENTS.sort());
    });

    it("should have valid template references in identities", () => {
      IDENTITY_TEMPLATES.forEach(template => {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.defaultAgent).toBeDefined();
        expect(template.defaultAlias).toBeDefined();
        expect(template.content).toBeDefined();
      });
    });
  });
});
