#!/bin/bash
# Blocks destructive git commands before Claude runs them.
# Customized for Stage League: normal `git push` is allowed (see CLAUDE.md §10 —
# only *force*-push is forbidden). Blocks history/work-destroying operations only.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

DANGEROUS_PATTERNS=(
  "push[[:space:]].*(--force|--force-with-lease|-f([[:space:]]|$))"  # force-push (any form)
  "reset[[:space:]]+--hard"                                          # discards working changes
  "git[[:space:]]+clean[[:space:]]+-[a-zA-Z]*f"                      # deletes untracked files
  "git[[:space:]]+branch[[:space:]]+-D"                              # force-deletes a branch
  "git[[:space:]]+checkout[[:space:]]+\\."                           # discards all working changes
  "git[[:space:]]+restore[[:space:]]+\\."                            # discards all working changes
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches dangerous pattern '$pattern'. The user has prevented you from doing this (CLAUDE.md §10)." >&2
    exit 2
  fi
done

exit 0
