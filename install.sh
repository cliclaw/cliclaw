#!/usr/bin/env bash
# CLIClaw installer
# Usage: curl -fsSL https://raw.githubusercontent.com/cliclaw/cliclaw/main/install.sh | bash

set -euo pipefail

REPO="cliclaw/cliclaw"
INSTALL_DIR="${CLICLAW_INSTALL_DIR:-$HOME/.cliclaw/bin}"
CLONE_DIR="${TMPDIR:-/tmp}/cliclaw-install-$$"

info()  { printf "\033[36m%s\033[0m\n" "$*"; }
warn()  { printf "\033[33m%s\033[0m\n" "$*"; }
error() { printf "\033[31mError: %s\033[0m\n" "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || error "Node.js is required. Install it from https://nodejs.org"
command -v npm  >/dev/null 2>&1 || error "npm is required."
command -v git  >/dev/null 2>&1 || error "git is required."

NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
[ "$NODE_MAJOR" -ge 18 ] 2>/dev/null || error "Node.js 18+ required (found v$(node -v))"

if [ -f "$INSTALL_DIR/cliclaw" ]; then
  info "⚡ Upgrading CLIClaw..."
else
  info "⚡ Installing CLIClaw..."
fi

rm -rf "$CLONE_DIR"
git clone --depth 1 "https://github.com/${REPO}.git" "$CLONE_DIR" 2>/dev/null
cd "$CLONE_DIR"
npm install --ignore-scripts 2>/dev/null
npx tsc 2>/dev/null

mkdir -p "$INSTALL_DIR"
rm -rf "$INSTALL_DIR/cliclaw-dist"
cp -r dist/ "$INSTALL_DIR/cliclaw-dist/"
cp package.json "$INSTALL_DIR/cliclaw-dist/"
cp -r node_modules/ "$INSTALL_DIR/cliclaw-dist/node_modules/" 2>/dev/null || true

cat > "$INSTALL_DIR/cliclaw" << WRAPPER
#!/usr/bin/env bash
exec node "${INSTALL_DIR}/cliclaw-dist/index.js" "\$@"
WRAPPER
chmod +x "$INSTALL_DIR/cliclaw"

rm -rf "$CLONE_DIR"

if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
  SHELL_RC=""
  case "${SHELL:-}" in
    */zsh)  SHELL_RC="$HOME/.zshrc" ;;
    */bash) SHELL_RC="$HOME/.bashrc" ;;
    *)      SHELL_RC="$HOME/.profile" ;;
  esac

  EXPORT_LINE="export PATH=\"${INSTALL_DIR}:\$PATH\""

  if [ -n "$SHELL_RC" ] && ! grep -qF "$INSTALL_DIR" "$SHELL_RC" 2>/dev/null; then
    echo "" >> "$SHELL_RC"
    echo "# CLIClaw" >> "$SHELL_RC"
    echo "$EXPORT_LINE" >> "$SHELL_RC"
    info "Added ${INSTALL_DIR} to PATH in ${SHELL_RC}"
    info "Run: source ${SHELL_RC}"
  else
    info "Add to your shell profile: ${EXPORT_LINE}"
  fi
fi

info ""
info "✅ CLIClaw installed!"
info ""
info "Get started:"
info "  cliclaw help          Show all commands"
info "  cd your-project/"
info "  cliclaw setup         Interactive setup wizard"
info "  cliclaw cron          Start the autonomous agent loop"
info ""
