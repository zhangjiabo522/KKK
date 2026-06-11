# KAgent CLI

Terminal version of KAgent for use with OpenCode, Claude Code, and other terminal-based tools.

## Features

- **File Change Tracking**: Automatically record file edits as K-line data
- **Market View**: See all tracked files at a glance
- **K-line Charts**: ASCII art visualization of file edit history
- **Cross-platform**: Works on Linux, macOS, and Windows (with Node.js)

## Installation

### Quick Install (Global)

```bash
# Clone the repository
git clone https://github.com/JStone2934/KAgent.git
cd KAgent/cli

# Link globally
npm link

# Now you can use 'kagent' command anywhere
kagent init
kagent watch
```

### Local Install

```bash
# Clone the repository
git clone https://github.com/JStone2934/KAgent.git
cd KAgent/cli

# Install dependencies (none required, but good practice)
npm install

# Run directly
node index.js init
node index.js watch
```

## Usage

### Initialize KAgent

```bash
cd /path/to/your/project
kagent init
```

This creates a `.kagent` directory to store tracking data.

### Watch for Changes

```bash
kagent watch
```

Starts watching files for changes and records them automatically.

### View Market

```bash
kagent market
```

Shows all tracked files with edit counts and trends.

### View K-line Chart

```bash
kagent chart src/index.js
```

Displays an ASCII K-line chart for the specified file.

## Color Schemes

KAgent supports two color schemes:

- **A-stock (cn)**: Red for up, green for down (default)
- **US stock (us)**: Green for up, red for down

```bash
kagent --color-scheme us market
```

## Integration with Terminal Tools

### Claude Code / OpenCode

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
# KAgent CLI
export PATH="$PATH:/path/to/KAgent/cli"

# Or create an alias
alias kagent="node /path/to/KAgent/cli/index.js"
```

### Automatic Tracking

To automatically track all file changes, add this to your project's setup:

```bash
# Initialize KAgent
kagent init

# Start watching in background
kagent watch &
```

## Data Format

KAgent uses the same data format as the VS Code extension:

- `.kagent/events.ndjson`: NDJSON file with all edit events
- `.kagent/symbols.json`: File metadata and edit counts
- `.kagent/config.json`: Configuration (ignore patterns, etc.)

This means data is compatible between the CLI and VS Code extension.

## Examples

```bash
# Initialize in current directory
kagent init

# Start watching
kagent watch

# In another terminal, edit files...
# Changes will be recorded automatically

# View market
kagent market

# View chart for a specific file
kagent chart src/main.js

# With US stock colors
kagent --color-scheme us market
```

## Troubleshooting

### Files not being tracked

- Make sure you're in the project root directory
- Check that `.kagent` directory exists
- Verify file is not in ignore patterns

### No K-line chart data

- Edit the file after initializing KAgent
- Check `.kagent/events.ndjson` for recorded events

### Performance issues

- Large projects: Add unnecessary directories to `.kagent/config.json` ignore list
- Node modules: Already ignored by default

## License

MIT
