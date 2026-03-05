#!/usr/bin/env bash
# CLIClaw uninstaller
# Usage: curl -fsSL https://raw.githubusercontent.com/cliclaw/cliclaw/main/uninstall.sh | bash

set -euo pipefail

INSTALL_DIR="${CLICLAW_INSTALL_DIR:-$HOME/.cliclaw/bin}"

info()  { printf "\033[36m%s\033[0m\n" "$*"; }
warn()  { printf "\033[33m%s\033[0m\n" "$*"; }

if [ ! -f "$INSTALL_DIR/cliclaw" ]; then
  warn "CLIClaw is not installed at ${INSTALL_DIR}"
  exit 0
fi

info "Removing CLIClaw from ${INSTALL_DIR}..."
rm -rf "$INSTALL_DIR/cliclaw-dist"
rm -f "$INSTALL_DIR/cliclaw"

# Remove empty bin dir
rmdir "$INSTALL_DIR" 2>/dev/null || true

# Clean PATH from shell config
for rc in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
  if [ -f "$rc" ] && grep -qF "$INSTALL_DIR" "$rc"; then
    sed -i.bak "/# CLIClaw/d;/$(echo "$INSTALL_DIR" | sed 's/\//\\\//g')/d" "$rc"
    rm -f "${rc}.bak"
    info "Cleaned PATH entry from ${rc}"
  fi
done

info ""
info "✅ CLIClaw uninstalled."
info ""
info "Note: Project-level .cliclaw/ directories were not removed."
info "Delete them manually if needed: rm -rf your-project/.cliclaw/"
info ""
