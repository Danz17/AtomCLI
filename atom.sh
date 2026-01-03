#!/usr/bin/env bash
# ============================================================================
#                              ATOMCLI LAUNCHER
#                         Bash Bootstrap Script
# ============================================================================
# Detects available runtimes and launches AtomCLI with user's choice
# Supports: Linux, macOS, WSL, Git Bash
# ============================================================================

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─────────────────────────────────────────────────────────────────────────────
# Colors
# ─────────────────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ─────────────────────────────────────────────────────────────────────────────
# Functions
# ─────────────────────────────────────────────────────────────────────────────

print_banner() {
    echo ""
    echo -e "${CYAN}   ╔═══════════════════════════════════════════════════════════╗${RESET}"
    echo -e "${CYAN}   ║                     ${BOLD}⚛️  ATOMCLI  ⚛️${RESET}${CYAN}                        ║${RESET}"
    echo -e "${CYAN}   ║            Cross-Platform CLI Build System                ║${RESET}"
    echo -e "${CYAN}   ╚═══════════════════════════════════════════════════════════╝${RESET}"
    echo ""
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

get_version() {
    local cmd="$1"
    local flag="${2:---version}"
    "$cmd" "$flag" 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown"
}

detect_runtimes() {
    HAS_BUN=0
    HAS_NODE=0
    BUN_VERSION=""
    NODE_VERSION=""

    if command_exists bun; then
        HAS_BUN=1
        BUN_VERSION=$(get_version bun)
    fi

    if command_exists node; then
        HAS_NODE=1
        NODE_VERSION=$(get_version node -v)
    fi
}

show_runtime_status() {
    echo -e "${YELLOW}Detected Runtimes:${RESET}"
    echo ""

    if [ "$HAS_BUN" -eq 1 ]; then
        echo -e "  [${GREEN}✓${RESET}] Bun ${DIM}${BUN_VERSION}${RESET}"
    else
        echo -e "  [ ] Bun ${DIM}(not installed)${RESET}"
    fi

    if [ "$HAS_NODE" -eq 1 ]; then
        echo -e "  [${GREEN}✓${RESET}] Node.js ${DIM}${NODE_VERSION}${RESET}"
    else
        echo -e "  [ ] Node.js ${DIM}(not installed)${RESET}"
    fi

    echo ""
}

show_menu() {
    echo -e "${CYAN}Select Runtime:${RESET}"
    echo ""

    local idx=1

    if [ "$HAS_BUN" -eq 1 ]; then
        echo -e "  [${idx}] Bun ${BUN_VERSION} ${YELLOW}(Recommended)${RESET}"
        BUN_KEY=$idx
        ((idx++))
    fi

    if [ "$HAS_NODE" -eq 1 ]; then
        local rec=""
        [ "$HAS_BUN" -eq 0 ] && rec=" ${YELLOW}(Recommended)${RESET}"
        echo -e "  [${idx}] Node.js ${NODE_VERSION}${rec}"
        NODE_KEY=$idx
        ((idx++))
    fi

    echo -e "  ${DIM}[q] Quit${RESET}"
    echo ""
}

read_single_key() {
    local key
    read -rsn1 key
    echo "$key"
}

launch_atomcli() {
    local runtime="$1"
    local atom_script="${SCRIPT_DIR}/atom.js"

    if [ ! -f "$atom_script" ]; then
        echo -e "${RED}ERROR: atom.js not found at ${atom_script}${RESET}"
        exit 1
    fi

    echo ""
    echo -e "${GREEN}Starting AtomCLI with ${runtime}...${RESET}"
    echo ""

    case "$runtime" in
        bun)
            exec bun "$atom_script" "$@"
            ;;
        node)
            exec node "$atom_script" "$@"
            ;;
    esac
}

show_help() {
    echo "AtomCLI Launcher - Bash Bootstrap Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -r, --runtime <bun|node>  Force specific runtime"
    echo "  -h, --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                 # Auto-detect/select runtime"
    echo "  $0 -r bun          # Force Bun runtime"
    echo "  $0 -r node         # Force Node.js runtime"
    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Parse Arguments
# ─────────────────────────────────────────────────────────────────────────────

FORCE_RUNTIME=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -r|--runtime)
            FORCE_RUNTIME="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            # Pass remaining args to atom.js
            break
            ;;
    esac
done

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

main() {
    print_banner
    detect_runtimes
    show_runtime_status

    # Check if any runtime available
    if [ "$HAS_BUN" -eq 0 ] && [ "$HAS_NODE" -eq 0 ]; then
        echo ""
        echo -e "${RED}ERROR: No JavaScript runtime found!${RESET}"
        echo ""
        echo "Please install one of the following:"
        echo "  - Bun:     https://bun.sh"
        echo "  - Node.js: https://nodejs.org"
        echo ""
        exit 1
    fi

    # Handle forced runtime
    if [ -n "$FORCE_RUNTIME" ]; then
        case "$FORCE_RUNTIME" in
            bun)
                if [ "$HAS_BUN" -eq 1 ]; then
                    launch_atomcli bun "$@"
                else
                    echo -e "${RED}ERROR: Bun is not installed${RESET}"
                    exit 1
                fi
                ;;
            node)
                if [ "$HAS_NODE" -eq 1 ]; then
                    launch_atomcli node "$@"
                else
                    echo -e "${RED}ERROR: Node.js is not installed${RESET}"
                    exit 1
                fi
                ;;
            *)
                echo -e "${RED}ERROR: Unknown runtime '${FORCE_RUNTIME}'${RESET}"
                exit 1
                ;;
        esac
    fi

    # Auto-select if only one runtime available
    if [ "$HAS_BUN" -eq 1 ] && [ "$HAS_NODE" -eq 0 ]; then
        echo -e "${GREEN}Using Bun (only available runtime)${RESET}"
        launch_atomcli bun "$@"
    fi

    if [ "$HAS_BUN" -eq 0 ] && [ "$HAS_NODE" -eq 1 ]; then
        echo -e "${GREEN}Using Node.js (only available runtime)${RESET}"
        launch_atomcli node "$@"
    fi

    # Both available - let user choose
    show_menu

    while true; do
        echo -ne "${CYAN}Enter choice: ${RESET}"
        key=$(read_single_key)
        echo "$key"

        case "$key" in
            "$BUN_KEY")
                [ "$HAS_BUN" -eq 1 ] && launch_atomcli bun "$@"
                ;;
            "$NODE_KEY")
                [ "$HAS_NODE" -eq 1 ] && launch_atomcli node "$@"
                ;;
            q|Q)
                echo ""
                echo -e "${YELLOW}Goodbye!${RESET}"
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid choice${RESET}"
                ;;
        esac
    done
}

main "$@"
