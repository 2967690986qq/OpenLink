#!/usr/bin/env bash
# OpenLink Gateway - One-click installer
# Usage: curl -fsSL https://raw.githubusercontent.com/your-org/openlink-gateway/main/scripts/install.sh | bash
# Or locally: bash scripts/install.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

INSTALL_DIR="${INSTALL_DIR:-$HOME/openlink-gateway}'
BRANCH="${BRANCH:-main}"

print_banner() {
    echo -e "${CYAN}"
    echo "   ██████  ██████  ███████ ███    ██ ██      ██ ███    ██ ██   ██ "
    echo "  ██    ██ ██   ██ ██      ████   ██ ██      ██ ████   ██ ██  ██  "
    echo "  ██    ██ ██████  █████   ██ ██  ██ ██      ██ ██ ██  ██ █████   "
    echo "  ██    ██ ██      ██      ██  ██ ██ ██      ██ ██  ██ ██ ██  ██  "
    echo "   ██████  ██      ███████ ██   ████ ███████ ██ ██   ████ ██   ██ "
    echo ""
    echo "  AI Gateway for Dify + DingTalk + Feishu"
    echo -e "${NC}"
}

check_requirements() {
    echo -e "${CYAN}[1/5]${NC} Checking system requirements..."
    echo ""

    local ok=true

    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | sed 's/v//')
        NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
        if [ "$NODE_MAJOR" -ge 18 ]; then
            echo -e "  ✓ Node.js ${NODE_VERSION}"
        else
            echo -e "  ${RED}✗${NC Node.js version >= 18 required (found $NODE_VERSION)"
            ok=false
        fi
    else
        echo -e "  ${RED}✗${NC} Node.js not found"
        echo ""
        echo "  Please install Node.js 18+ from https://nodejs.org/"
        ok=false
    fi

    # Check npm
    if command -v npm &> /dev/null; then
        echo -e "  ✓ npm $(npm --version)"
    else
        echo -e "  ${RED}✗${NC} npm not found (should come with Node.js)"
        ok=false
    fi

    echo ""

    if [ "$ok" = false ]; then
        echo -e "${RED}Please fix the issues above and retry.${NC}"
        exit 1
    fi
}

download_source() {
    echo -e "${CYAN}[2/5]${NC} Setting up installation directory..."
    echo "  Installing to: $INSTALL_DIR"
    echo ""

    if [ -d "$INSTALL_DIR" ]; then
        echo -e "  ${YELLOW}!${NC} Directory already exists."
        read -p "  Remove existing installation found. Continue? [y/N] " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$INSTALL_DIR"
        else
            echo "Aborted."
            exit 0
        fi
    fi

    mkdir -p "$(dirname "$INSTALL_DIR")"

    # If running from a cloned repo, just copy files
    if [ -f "$(dirname "${BASH_SOURCE[0]}")/../package.json ]; then
        echo "  Copying from current project files..."
        cp -r "$(dirname "${BASH_SOURCE[0]}")/.." "$INSTALL_DIR"
    else
        echo "  Cloning from GitHub (${BRANCH} branch..."
        if command -v git &> /dev/null; then
            git clone --branch "$BRANCH" "https://github.com/your-org/openlink-gateway.git" "$INSTALL_DIR" 2>/dev/null || {
                echo -e "${RED}Failed to clone repository.${NC}"
                exit 1
            }
        else
            echo "  Git not available, using curl to download zip..."
            TMP_FILE="/tmp/openlink-gateway.tar.gz"
            curl -fsSL -o "$TMP_FILE" "https://github.com/your-org/openlink-gateway/archive/${BRANCH}.tar.gz"
            mkdir -p "$INSTALL_DIR"
            tar -xzf "$TMP_FILE" -C "$INSTALL_DIR" --strip-components=1
            rm "$TMP_FILE"
        fi
    fi

    echo -e "  ${GREEN}✓${NC} Source ready"
    echo ""
}

install_deps() {
    echo -e "${CYAN}[3/5]${NC} Installing dependencies..."
    echo ""

    cd "$INSTALL_DIR"
    npm install

    echo ""
    echo -e "  ${GREEN}✓${NC} Dependencies installed"
    echo ""
}

build_project() {
    echo -e "${CYAN}[4/5]${NC} Building gateway..."
    echo ""

    cd "$INSTALL_DIR"
    npm run build

    echo ""
    echo -e "  ${GREEN}✓${NC} Build complete"
    echo ""
}

setup_path() {
    echo -e "${CYAN}[5/5]${NC} Setting up CLI command..."
    echo ""

    # Make the script executable and link to /usr/local/bin
    chmod +x "$INSTALL_DIR/openlink"

    # Create symlink if possible
    if [ -w "/usr/local/bin" ]; then
        ln -sf "$INSTALL_DIR/openlink" /usr/local/bin/openlink
        echo "  Created symlink: /usr/local/bin/openlink"
    else
        echo -e "  Cannot create global symlink (permission denied)."
        echo "  You can add the following to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
        echo "  export PATH=\"$INSTALL_DIR:\$PATH"
    fi

    echo ""
    echo -e "  ${GREEN}✓${NC} Installation complete!"
}

print_next_steps() {
    echo ""
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo -e "  ${GREEN}OpenLink Gateway installed successfully!${NC}"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "  Installation directory: $INSTALL_DIR"
    echo ""
    echo "  Quick start commands:"
    echo ""
    echo -e "  ${GREEN}• openlink start --daemon${NC}   Start gateway in background"
    echo -e "  ${GREEN}• openlink status${NC}              Check if running"
    echo -e "  ${GREEN}• openlink logs --tail${NC}        Live log streaming"
    echo -e "  ${GREEN}• openlink stop${NC}               Stop the gateway"
    echo ""
    echo -e "  ${GREEN}• openlink dev${NC}                Development mode"
    echo ""
    echo "  Default URLs:"
    echo "    Web UI : http://localhost:3000/ui/"
    echo "    API    : http://localhost:3000/api"
    echo "    Health : http://localhost:3000/health"
    echo ""
    echo "════════════════════════════════════════════════════════════"
}

# Main execution
print_banner
check_requirements
download_source
install_deps
build_project
setup_path
print_next_steps
