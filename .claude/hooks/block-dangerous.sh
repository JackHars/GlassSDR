#!/bin/bash
# PreToolUse hook: block destructive commands during autonomous loop runs.
# Receives the tool invocation JSON on stdin; blocks via exit code 2 if the
# Bash command matches a dangerous pattern.

CMD=$(jq -r '.tool_input.command // ""')

# Patterns to block:
#   - git push (any form)
#   - git reset --hard
#   - git checkout main / master  (don't let the loop wander off its branch)
#   - git branch -D main / master  (don't let it nuke main)
#   - rm -rf with absolute / dangerous paths
#   - sudo
#   - curl ... | bash  /  curl ... | sh  (no random script execution)
#   - any branch -D autonomous-build  (would orphan its own work)
DANGEROUS='(git +push)|(git +reset +--hard)|(git +checkout +(main|master))|(git +branch +-D +(main|master|autonomous-build))|(rm +-rf +(/|~|/Users/|/tmp/mayhem-autonomous))|(sudo +)|(curl[^|]*\| *(bash|sh|zsh))'

if echo "$CMD" | grep -qE "$DANGEROUS"; then
  jq -n --arg cmd "$CMD" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("BLOCKED in autonomous mode: " + $cmd)
    }
  }'
  exit 2
fi

# Commit-message attribution guard: forbid "Claude" or "Co-Authored-By" in any
# `git commit` invocation. The author wants no AI attribution in the history.
if echo "$CMD" | grep -qE 'git +commit' && echo "$CMD" | grep -qiE '(Claude|Co-Authored-By|Co-Author|🤖|Generated with)'; then
  jq -n --arg cmd "$CMD" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "BLOCKED: commit message contains AI attribution. Rewrite the message with NO mention of Claude, Co-Authored-By, or AI tooling."
    }
  }'
  exit 2
fi

exit 0
