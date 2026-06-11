#!/bin/bash

# KAgent Hook for Claude Code / OpenCode
# This script is called by the hook system to record file changes

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"

# Check if kagent CLI is available
if ! command -v kagent &> /dev/null; then
  # Try to use the local CLI
  if [ -f "$HOOK_DIR/../../../cli/index.js" ]; then
    KAGENT_CMD="node $HOOK_DIR/../../../cli/index.js"
  else
    echo "KAgent CLI not found. Please install it first."
    exit 1
  fi
else
  KAGENT_CMD="kagent"
fi

# Get file path from arguments
FILE_PATH="$1"

if [ -z "$FILE_PATH" ]; then
  echo "Usage: $0 <file_path>"
  exit 1
fi

# Convert to absolute path if relative
if [[ ! "$FILE_PATH" = /* ]]; then
  FILE_PATH="$PROJECT_ROOT/$FILE_PATH"
fi

# Check if file exists
if [ ! -f "$FILE_PATH" ]; then
  echo "File not found: $FILE_PATH"
  exit 1
fi

# Record the change
# This is a simplified version - in practice, you'd need to track the previous content
# For now, we'll just record the current state
cd "$PROJECT_ROOT"
$KAGENT_CMD init
