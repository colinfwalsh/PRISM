#!/usr/bin/env bash
#
# PRISM installer — Plan · Research · Implement · Synthesize · Maintain
#
# Installs PRISM's commands, agents, and skills into your AI coding tools.
# Currently supports: Claude Code, Windsurf.
#
# Usage:
#   ./install.sh                  # interactive
#   ./install.sh --claude         # install Claude Code only
#   ./install.sh --windsurf       # install Windsurf workflows (to CWD)
#   ./install.sh --all            # install everywhere
#   ./install.sh --help

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# Setup
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Paths
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
WINDSURF_PROJECT_DIR="${WINDSURF_PROJECT_DIR:-$PWD/.windsurf}"

# Colors (only when stdout is a tty)
if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
  RED=$'\033[38;5;203m'; ORANGE=$'\033[38;5;215m'; YELLOW=$'\033[38;5;221m'
  GREEN=$'\033[38;5;120m'; BLUE=$'\033[38;5;75m'; PURPLE=$'\033[38;5;141m'
  CYAN=$'\033[36m'; GRAY=$'\033[38;5;244m'
else
  BOLD=''; DIM=''; RESET=''
  RED=''; ORANGE=''; YELLOW=''; GREEN=''; BLUE=''; PURPLE=''; CYAN=''; GRAY=''
fi

# ──────────────────────────────────────────────────────────────────────────────
# Logging helpers
# ──────────────────────────────────────────────────────────────────────────────

info()    { printf "%s\n" "$*"; }
step()    { printf "${CYAN}▸${RESET} %s\n" "$*"; }
ok()      { printf "${GREEN}✓${RESET} %s\n" "$*"; }
warn()    { printf "${YELLOW}⚠${RESET} %s\n" "$*"; }
fail()    { printf "${RED}✗${RESET} %s\n" "$*" >&2; }

# ──────────────────────────────────────────────────────────────────────────────
# Logo
# ──────────────────────────────────────────────────────────────────────────────

print_logo() {
  printf "\n"
  printf "${BOLD}${PURPLE}██████╗ ██████╗ ██╗███████╗███╗   ███╗${RESET}      ╱│\n"
  printf "${BOLD}${PURPLE}██╔══██╗██╔══██╗██║██╔════╝████╗ ████║${RESET}     ╱ │  ${RED}━━━━━${RESET} Plan\n"
  printf "${BOLD}${PURPLE}██████╔╝██████╔╝██║███████╗██╔████╔██║${RESET}    ╱  │ ${ORANGE}━━━━━━${RESET} Research\n"
  printf "${BOLD}${PURPLE}██╔═══╝ ██╔══██╗██║╚════██║██║╚██╔╝██║${RESET}   ╱   │${YELLOW}━━━━━━━${RESET} Implement\n"
  printf "${BOLD}${PURPLE}██║     ██║  ██║██║███████║██║ ╚═╝ ██║${RESET}  ╱    │ ${GREEN}━━━━━━${RESET} Synthesize\n"
  printf "${BOLD}${PURPLE}╚═╝     ╚═╝  ╚═╝╚═╝╚══════╝╚═╝     ╚═╝${RESET} ╱_____│  ${BLUE}━━━━━${RESET} Maintain\n"
  printf "\n"
  printf "${DIM}A toolkit of commands, sub-agents, and skills for AI coding workflows.${RESET}\n"
  printf "\n"
}

# ──────────────────────────────────────────────────────────────────────────────
# Install helpers
# ──────────────────────────────────────────────────────────────────────────────

# Copy a single file or directory into a destination directory, backing up
# anything that would be overwritten to <name>.bak.<timestamp>
copy_with_backup() {
  local src="$1"
  local dest_dir="$2"
  local name
  name="$(basename "$src")"
  local dest="$dest_dir/$name"

  if [ -e "$dest" ]; then
    local backup="${dest}.bak.$(date +%Y%m%d-%H%M%S)"
    mv "$dest" "$backup"
    printf "  ${GRAY}backed up existing → $(basename "$backup")${RESET}\n"
  fi

  if [ -d "$src" ]; then
    cp -R "$src" "$dest_dir/"
  else
    cp "$src" "$dest_dir/"
  fi
}

# Copy every entry in a source dir into a destination dir
install_dir_contents() {
  local src_dir="$1"
  local dest_dir="$2"
  local label="$3"

  if [ ! -d "$src_dir" ]; then
    warn "Source not found: $src_dir (skipping $label)"
    return 0
  fi

  mkdir -p "$dest_dir"
  local count=0
  for entry in "$src_dir"/*; do
    [ -e "$entry" ] || continue
    copy_with_backup "$entry" "$dest_dir"
    count=$((count + 1))
  done
  ok "Installed $count $label → ${DIM}$dest_dir${RESET}"
}

# ──────────────────────────────────────────────────────────────────────────────
# Install targets
# ──────────────────────────────────────────────────────────────────────────────

install_claude_code() {
  printf "\n${BOLD}Installing to Claude Code${RESET} ${DIM}($CLAUDE_HOME)${RESET}\n"
  step "commands"
  install_dir_contents "$SCRIPT_DIR/commands" "$CLAUDE_HOME/commands" "commands"
  step "agents"
  install_dir_contents "$SCRIPT_DIR/agents"   "$CLAUDE_HOME/agents"   "agents"
  step "skills"
  install_dir_contents "$SCRIPT_DIR/skills"   "$CLAUDE_HOME/skills"   "skills"
}

install_windsurf() {
  printf "\n${BOLD}Installing to Windsurf${RESET} ${DIM}($WINDSURF_PROJECT_DIR)${RESET}\n"
  printf "${DIM}Note: Windsurf workflows are project-scoped. Installing into the current project.${RESET}\n"

  step "workflows (from commands/)"
  install_dir_contents "$SCRIPT_DIR/commands" "$WINDSURF_PROJECT_DIR/workflows" "workflows"

  warn "Windsurf does not natively support sub-agents or skills the way Claude Code does."
  warn "Only commands are installed as workflows. Agents and skills are Claude Code-only."
}

# ──────────────────────────────────────────────────────────────────────────────
# Interactive prompt
# ──────────────────────────────────────────────────────────────────────────────

prompt_targets() {
  printf "${BOLD}Where would you like to install PRISM?${RESET}\n"
  printf "\n"
  printf "  ${CYAN}1)${RESET} Claude Code         ${DIM}(commands + agents + skills → $CLAUDE_HOME)${RESET}\n"
  printf "  ${CYAN}2)${RESET} Windsurf            ${DIM}(workflows → $WINDSURF_PROJECT_DIR/workflows)${RESET}\n"
  printf "  ${CYAN}3)${RESET} Both\n"
  printf "  ${CYAN}q)${RESET} Quit\n"
  printf "\n"
  printf "Choose [1-3, q]: "
  read -r choice
  printf "\n"

  case "$choice" in
    1) install_claude_code ;;
    2) install_windsurf ;;
    3) install_claude_code; install_windsurf ;;
    q|Q) info "Cancelled."; exit 0 ;;
    *) fail "Invalid choice: $choice"; exit 1 ;;
  esac
}

# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

print_help() {
  cat <<EOF
${BOLD}PRISM installer${RESET}

  ${DIM}Plan · Research · Implement · Synthesize · Maintain${RESET}

Usage:
  ./install.sh                Interactive prompt
  ./install.sh --claude       Install to Claude Code ($CLAUDE_HOME)
  ./install.sh --windsurf     Install to Windsurf (current project)
  ./install.sh --all          Install to both
  ./install.sh --help         Show this help

Environment overrides:
  CLAUDE_HOME=<path>          Override Claude Code install root
  WINDSURF_PROJECT_DIR=<path> Override Windsurf project .windsurf dir
EOF
}

main() {
  print_logo

  if [ $# -eq 0 ]; then
    prompt_targets
  else
    case "$1" in
      --claude)    install_claude_code ;;
      --windsurf)  install_windsurf ;;
      --all)       install_claude_code; install_windsurf ;;
      --help|-h)   print_help; exit 0 ;;
      *)           fail "Unknown flag: $1"; print_help; exit 1 ;;
    esac
  fi

  printf "\n${GREEN}${BOLD}Done.${RESET}\n"
  printf "${DIM}Existing files were backed up with a .bak.<timestamp> suffix.${RESET}\n\n"
}

main "$@"
