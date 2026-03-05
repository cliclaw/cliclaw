.PHONY: help build install install-global cron personai memory memory-search setup status audit rollback logs clean dry-run dev

RUNNER := npx tsx src/index.ts

help: ## Show available commands
	@echo ""
	@echo "  CLIClaw — Autonomous AI Agent Loop Runner"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""

install: ## Install dependencies
	npm install

build: ## Build TypeScript to dist/
	npm run build

install-global: build ## Build and install cliclaw globally (~/.cliclaw/bin/)
	@INSTALL_DIR="$$HOME/.cliclaw/bin" && \
	mkdir -p "$$INSTALL_DIR" && \
	rm -rf "$$INSTALL_DIR/cliclaw-dist" && \
	cp -r dist/ "$$INSTALL_DIR/cliclaw-dist/" && \
	cp package.json "$$INSTALL_DIR/cliclaw-dist/" && \
	cp -r node_modules/ "$$INSTALL_DIR/cliclaw-dist/node_modules/" 2>/dev/null; \
	printf '#!/usr/bin/env bash\nexec node "%s/cliclaw-dist/index.js" "$$@"\n' "$$INSTALL_DIR" > "$$INSTALL_DIR/cliclaw" && \
	chmod +x "$$INSTALL_DIR/cliclaw" && \
	echo "✅ Installed to $$INSTALL_DIR/cliclaw"

cron: ## Start autonomous agent loop (FOCUS="name" ENGINE="kiro" DRY_RUN=1)
ifdef FOCUS
	$(RUNNER) cron $(if $(DRY_RUN),--dry-run) $(if $(ENGINE),--engine $(ENGINE)) "$(FOCUS)"
else ifdef DRY_RUN
	$(RUNNER) cron --dry-run $(if $(ENGINE),--engine $(ENGINE)) $(filter-out $@,$(MAKECMDGOALS))
else
	$(RUNNER) cron $(if $(ENGINE),--engine $(ENGINE)) $(filter-out $@,$(MAKECMDGOALS))
endif

personai: ## Configure AI persona interactively
	$(RUNNER) personai

memory: ## View/optimize memory
	$(RUNNER) memory

memory-search: ## Search memory (TERM="pattern")
	$(RUNNER) memory search "$(TERM)"

setup: ## Interactive setup wizard
	$(RUNNER) setup

status: ## Show current state, cost, and stats
	$(RUNNER) status

audit: ## Audit report from logs (N=100)
	$(RUNNER) audit $(N)

rollback: ## Restore state from a previous snapshot
	$(RUNNER) rollback

logs: ## View recent logs (N=100)
	$(RUNNER) logs $(N)

clean: ## Remove temp files, optionally logs/state
	$(RUNNER) clean

dry-run: ## Preview prompts without running agents
	$(RUNNER) cron --dry-run $(if $(FOCUS),"$(FOCUS)")

dev: ## Run in development mode
	$(RUNNER) $(filter-out $@,$(MAKECMDGOALS))

%:
	@:
