# KAgent Integration Guide

This guide explains how to integrate KAgent CLI with Claude Code, OpenCode, and other terminal-based AI coding tools.

## Quick Start

### 1. Install KAgent CLI

```bash
# Clone the repository
git clone https://github.com/JStone2934/KAgent.git
cd KAgent/cli

# Install globally
npm link

# Verify installation
kagent help
```

### 2. Initialize in Your Project

```bash
cd /path/to/your/project
kagent init
```

### 3. Start Tracking

```bash
# Option 1: Watch for changes (recommended)
kagent watch &

# Option 2: Manually record changes
# (The CLI will automatically track when you edit files)
```

## Integration with Claude Code

### Method 1: Automatic Tracking (Recommended)

Claude Code automatically tracks file changes. KAgent can be integrated by:

1. Initialize KAgent in your project:
   ```bash
   kagent init
   ```

2. Add to your Claude Code configuration (`~/.claude/config.json`):
   ```json
   {
     "hooks": {
       "afterEdit": "kagent record {{file}}",
       "afterSave": "kagent record {{file}}"
     }
   }
   ```

3. Or use the shell hook:
   ```bash
   # Add to ~/.bashrc or ~/.zshrc
   export PATH="$PATH:/path/to/KAgent/cli"
   
   # Create a function to record changes
   kagent-record() {
     kagent record "$1"
   }
   ```

### Method 2: Manual Tracking

```bash
# In Claude Code terminal
kagent init

# After each edit session
kagent market  # View tracked files
kagent chart src/main.js  # View specific file
```

## Integration with OpenCode

### Method 1: Shell Integration

```bash
# Add to ~/.bashrc or ~/.zshrc
export PATH="$PATH:/path/to/KAgent/cli"

# Create aliases
alias kagent-market="kagent market"
alias kagent-chart="kagent chart"
```

### Method 2: Hook Script

```bash
# Create a hook script
cat > ~/.opencode/hooks/kagent.sh << 'EOF'
#!/bin/bash
FILE="$1"
if [ -n "$FILE" ] && [ -f "$FILE" ]; then
  kagent record "$FILE"
fi
EOF

chmod +x ~/.opencode/hooks/kagent.sh
```

### Method 3: Background Watcher

```bash
# Start KAgent watcher in background
kagent watch &

# Use OpenCode normally
# Changes will be tracked automatically
```

## Viewing Data

### Market View

```bash
# See all tracked files
kagent market

# With US stock colors
kagent --color-scheme us market
```

### K-line Charts

```bash
# View chart for a specific file
kagent chart src/index.js

# View chart with US stock colors
kagent --color-scheme us chart src/index.js
```

### Real-time Monitoring

```bash
# Watch for changes and see live updates
kagent watch

# Output example:
# ▲ src/index.js (3 → 5 lines)
# ▼ src/utils.js (10 → 8 lines)
# ─ src/config.js (same lines)
```

## Advanced Configuration

### Custom Ignore Patterns

Edit `.kagent/config.json`:

```json
{
  "ignore": [
    "node_modules",
    ".git",
    "dist",
    "build",
    "*.log",
    "*.lock",
    "coverage",
    ".nyc_output"
  ]
}
```

### Color Schemes

```bash
# A-stock colors (default): Red up, Green down
kagent --color-scheme cn market

# US stock colors: Green up, Red down
kagent --color-scheme us market
```

### Data Compatibility

KAgent CLI uses the same data format as the VS Code extension:

- `.kagent/events.ndjson` - Edit events
- `.kagent/symbols.json` - File metadata
- `.kagent/config.json` - Configuration

This means you can:
1. Use CLI in terminal, VS Code extension in editor
2. Share data between different tools
3. View the same data in different interfaces

## Troubleshooting

### Files Not Being Tracked

```bash
# Check if KAgent is initialized
ls -la .kagent/

# Verify events are being recorded
cat .kagent/events.ndjson

# Check symbols
cat .kagent/symbols.json
```

### No K-line Chart Data

```bash
# Edit a file first
echo "test" >> test.txt

# Then check market
kagent market

# View chart
kagent chart test.txt
```

### Performance Issues

```bash
# Add large directories to ignore
echo '{"ignore": ["node_modules", ".git", "dist", "build"]}' > .kagent/config.json

# Or use the CLI to update config
kagent config add ignore node_modules
```

## Examples

### Basic Workflow

```bash
# 1. Initialize
cd my-project
kagent init

# 2. Start tracking
kagent watch &

# 3. Edit files with AI tool
# ... edit files ...

# 4. Check market
kagent market

# 5. View specific file chart
kagent chart src/main.js
```

### Advanced Workflow

```bash
# Initialize with custom colors
kagent init
kagent --color-scheme us market

# Start background watcher
kagent watch &

# Use AI tool normally
# ...

# Check market periodically
kagent market

# View detailed charts
kagent chart src/components/App.js
kagent chart src/utils/helpers.js
```

## Tips

1. **Use background watcher**: Start `kagent watch &` before using AI tools
2. **Check market often**: Run `kagent market` to see overall activity
3. **View specific charts**: Use `kagent chart <file>` for detailed view
4. **Customize colors**: Use `--color-scheme us` for different color scheme
5. **Share data**: Data is compatible with VS Code extension

## Support

For issues or questions:
- GitHub: https://github.com/JStone2934/KAgent
- Issues: https://github.com/JStone2934/KAgent/issues
