#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, statSync } from 'fs';
import { join, relative, dirname, extname } from 'path';
import { createHash } from 'crypto';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

// Default ignore patterns
const defaultIgnorePatterns = [
  'node_modules',
  '.git',
  '.kagent',
  'dist',
  'build',
  '.next',
  '.vscode',
  '.idea',
  '*.log',
  '*.lock',
];

class KagentCLI {
  constructor() {
    this.workspaceRoot = process.cwd();
    this.kagentDir = join(this.workspaceRoot, '.kagent');
    this.eventsPath = join(this.kagentDir, 'events.ndjson');
    this.symbolsPath = join(this.kagentDir, 'symbols.json');
    this.configPath = join(this.kagentDir, 'config.json');
    this.lastRecordedContent = new Map();
    this.watchers = new Map();
    this.ignorePatterns = defaultIgnorePatterns;
    this.colorScheme = 'cn'; // 'cn' for A-stock, 'us' for US stock
  }

  // Initialize KAgent directory
  init() {
    if (!existsSync(this.kagentDir)) {
      mkdirSync(this.kagentDir, { recursive: true });
    }
    
    // Initialize config if not exists
    if (!existsSync(this.configPath)) {
      writeFileSync(this.configPath, JSON.stringify({ ignore: this.ignorePatterns }, null, 2));
    } else {
      const config = JSON.parse(readFileSync(this.configPath, 'utf8'));
      this.ignorePatterns = [...defaultIgnorePatterns, ...(config.ignore || [])];
    }

    // Initialize symbols if not exists
    if (!existsSync(this.symbolsPath)) {
      writeFileSync(this.symbolsPath, JSON.stringify({ symbols: {} }, null, 2));
    }

    console.log(`${colors.green}✓${colors.reset} KAgent initialized in ${this.kagentDir}`);
  }

  // Check if file should be ignored
  shouldIgnore(filePath) {
    const relativePath = relative(this.workspaceRoot, filePath);
    return this.ignorePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const ext = pattern.replace('*', '');
        return relativePath.includes(ext);
      }
      return relativePath.startsWith(pattern) || relativePath.includes('/' + pattern + '/');
    });
  }

  // Count lines in a file
  countLines(text) {
    if (!text) return 0;
    const lines = text.split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    return lines.length;
  }

  // Content hash for deduplication
  contentHash(text) {
    return createHash('md5').update(text || '').digest('hex').slice(0, 8);
  }

  // Record a file change
  recordChange(filePath, oldText, newText, source = 'onSave', actor = 'agent') {
    if (this.shouldIgnore(filePath)) {
      return { recorded: false, reason: 'ignored' };
    }

    const relativePath = relative(this.workspaceRoot, filePath);
    if (relativePath.startsWith('.kagent/')) {
      return { recorded: false, reason: 'ignored' };
    }

    const symbols = JSON.parse(readFileSync(this.symbolsPath, 'utf8'));
    const existing = symbols.symbols[relativePath];
    const isIpo = !existing;

    const linesBefore = oldText !== undefined ? this.countLines(oldText) : (existing?.last_lines || 0);
    const linesAfter = this.countLines(newText);

    // Calculate stats
    const oldLines = oldText ? oldText.split('\n').length : 0;
    const newLines = newText ? newText.split('\n').length : 0;
    
    let added = 0;
    let removed = 0;
    
    if (newLines > oldLines) {
      added = newLines - oldLines;
    } else if (newLines < oldLines) {
      removed = oldLines - newLines;
    }

    const net = added - removed;
    const lines_high = Math.max(linesBefore, linesAfter);
    const lines_low = Math.min(linesBefore, linesAfter);

    const hashAfter = this.contentHash(newText);
    const editCount = (existing?.edit_count || 0) + 1;
    const ts = Date.now();

    // Create event
    const event = {
      v: 2,
      ts,
      conversation_id: null,
      generation_id: null,
      file: relativePath,
      added,
      removed,
      net,
      lines_before: linesBefore,
      lines_after: linesAfter,
      lines_high,
      lines_low,
      is_ipo: isIpo,
      edit_index: editCount,
      source,
      actor,
      editor: 'cli',
      content_hash_after: hashAfter,
    };

    // Append to events file
    appendFileSync(this.eventsPath, JSON.stringify(event) + '\n');

    // Update symbols
    symbols.symbols[relativePath] = {
      ipo_ts: existing?.ipo_ts || ts,
      edit_count: editCount,
      last_lines: linesAfter,
      last_ts: ts,
      delisted: false,
      last_source: source,
      last_content_hash: hashAfter,
    };
    writeFileSync(this.symbolsPath, JSON.stringify(symbols, null, 2));

    return { recorded: true, event };
  }

  // Read all events
  readAllEvents() {
    if (!existsSync(this.eventsPath)) {
      return [];
    }

    const content = readFileSync(this.eventsPath, 'utf8');
    const events = [];
    
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) {
        try {
          events.push(JSON.parse(trimmed));
        } catch {
          // Skip bad line
        }
      }
    }

    return events;
  }

  // Build candles for a file
  buildCandlesForFile(events, file) {
    return events
      .filter(e => e.file === file)
      .sort((a, b) => a.edit_index - b.edit_index)
      .flatMap(e => {
        const removed = e.removed || 0;
        const added = e.added || 0;

        if (removed > 0 && added > 0) {
          const mid = Math.max(0, e.lines_before - removed);
          return [
            {
              time: Math.floor(e.ts / 1000),
              open: e.lines_before,
              close: mid,
              high: e.lines_high || Math.max(e.lines_before, mid),
              low: e.lines_low || Math.min(e.lines_before, mid),
              volume: removed,
              sub_step: 1,
              leg: 'drop',
              edit_index: e.edit_index,
              is_ipo: e.is_ipo,
            },
            {
              time: Math.floor(e.ts / 1000),
              open: mid,
              close: e.lines_after,
              high: e.lines_high || Math.max(mid, e.lines_after),
              low: e.lines_low || Math.min(mid, e.lines_after),
              volume: added,
              sub_step: 2,
              leg: 'rise',
              edit_index: e.edit_index,
              is_ipo: false,
            },
          ];
        }

        return [{
          time: Math.floor(e.ts / 1000),
          open: e.lines_before,
          close: e.lines_after,
          high: e.lines_high || Math.max(e.lines_before, e.lines_after),
          low: e.lines_low || Math.min(e.lines_before, e.lines_after),
          volume: added + removed,
          edit_index: e.edit_index,
          is_ipo: e.is_ipo,
        }];
      });
  }

  // Get last edit trend
  lastEditTrendForFile(events, file) {
    const candles = this.buildCandlesForFile(events, file);
    if (!candles.length) return null;
    
    const last = candles[candles.length - 1];
    if (last.close > last.open) return 'up';
    if (last.close < last.open) return 'down';
    return 'flat';
  }

  // Print ASCII K-line chart
  printKlineChart(candles, filename) {
    if (!candles.length) {
      console.log(`${colors.gray}No data for ${filename}${colors.reset}`);
      return;
    }

    // Find price range
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    
    for (const candle of candles) {
      minPrice = Math.min(minPrice, candle.low);
      maxPrice = Math.max(maxPrice, candle.high);
    }

    // Ensure we have a range
    if (minPrice === maxPrice) {
      minPrice = Math.max(0, minPrice - 10);
      maxPrice = maxPrice + 10;
    }

    const chartHeight = 12;
    const chartWidth = Math.min(candles.length, 30); // Show last 30 candles
    const displayCandles = candles.slice(-chartWidth);

    // Calculate price step
    const priceStep = (maxPrice - minPrice) / (chartHeight - 1);

    console.log(`\n${colors.bold}${colors.cyan}📈 ${filename}${colors.reset}`);
    console.log(`${colors.gray}   Last ${displayCandles.length} edits | Range: ${minPrice} - ${maxPrice} lines${colors.reset}\n`);

    // Build chart grid
    const grid = Array(chartHeight).fill(null).map(() => Array(chartWidth).fill(' '));

    // Draw each candle
    displayCandles.forEach((candle, x) => {
      const openIdx = Math.round((candle.open - minPrice) / priceStep);
      const closeIdx = Math.round((candle.close - minPrice) / priceStep);
      const highIdx = Math.round((candle.high - minPrice) / priceStep);
      const lowIdx = Math.round((candle.low - minPrice) / priceStep);

      const isUp = candle.close >= candle.open;
      const char = isUp ? '█' : '▓';
      const color = isUp ? 
        (this.colorScheme === 'cn' ? colors.red : colors.green) : 
        (this.colorScheme === 'cn' ? colors.green : colors.red);

      // Draw wick (high to low)
      for (let y = highIdx; y <= lowIdx; y++) {
        if (y >= 0 && y < chartHeight) {
          grid[y][x] = `${colors.gray}|${colors.reset}`;
        }
      }

      // Draw body (open to close)
      const bodyTop = Math.min(openIdx, closeIdx);
      const bodyBottom = Math.max(openIdx, closeIdx);
      
      for (let y = bodyTop; y <= bodyBottom; y++) {
        if (y >= 0 && y < chartHeight) {
          grid[y][x] = `${color}${char}${colors.reset}`;
        }
      }
    });

    // Print chart from top to bottom
    for (let y = chartHeight - 1; y >= 0; y--) {
      const price = Math.round(minPrice + y * priceStep);
      const priceStr = String(price).padStart(6);
      console.log(`${colors.gray}${priceStr} │${colors.reset}${grid[y].join('')}`);
    }

    // Print x-axis
    console.log(`${colors.gray}       └${'─'.repeat(chartWidth)}${colors.reset}`);
    console.log(`${colors.gray}        ${displayCandles.length} edits${colors.reset}`);
  }

  // Show market summary
  showMarket() {
    const events = this.readAllEvents();
    const symbols = JSON.parse(readFileSync(this.symbolsPath, 'utf8'));

    if (!Object.keys(symbols.symbols).length) {
      console.log(`${colors.yellow}No files tracked yet.${colors.reset}`);
      console.log(`${colors.gray}Edit a file to start tracking.${colors.reset}`);
      return;
    }

    console.log(`\n${colors.bold}${colors.magenta}═══════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bold}${colors.magenta}  KAgent Market - ${this.workspaceRoot}${colors.reset}`);
    console.log(`${colors.bold}${colors.magenta}═══════════════════════════════════════════${colors.reset}\n`);

    // Sort by last edit time
    const sortedSymbols = Object.entries(symbols.symbols)
      .sort(([, a], [, b]) => b.last_ts - a.last_ts);

    for (const [file, info] of sortedSymbols) {
      const trend = this.lastEditTrendForFile(events, file);
      const trendIcon = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '─';
      const trendColor = trend === 'up' ? 
        (this.colorScheme === 'cn' ? colors.red : colors.green) : 
        trend === 'down' ? 
        (this.colorScheme === 'cn' ? colors.green : colors.red) : 
        colors.gray;

      console.log(`${trendColor}${trendIcon}${colors.reset} ${colors.bold}${file}${colors.reset} ${colors.gray}(${info.edit_count} edits, ${info.last_lines} lines)${colors.reset}`);
    }

    console.log(`\n${colors.gray}Run 'kagent chart <file>' to see K-line chart${colors.reset}`);
  }

  // Show chart for a specific file
  showChart(filename) {
    const events = this.readAllEvents();
    const candles = this.buildCandlesForFile(events, filename);
    
    if (!candles.length) {
      console.log(`${colors.red}No data found for ${filename}${colors.reset}`);
      return;
    }

    this.printKlineChart(candles, filename);
  }

  // Watch files for changes
  watch() {
    console.log(`${colors.green}✓${colors.reset} Watching for file changes...`);
    console.log(`${colors.gray}Press Ctrl+C to stop${colors.reset}\n`);

    // Use inotifywait if available, otherwise use polling
    try {
      execSync('which inotifywait', { stdio: 'ignore' });
      this.watchWithInotify();
    } catch {
      this.watchWithPolling();
    }
  }

  // Watch using inotifywait (Linux)
  watchWithInotify() {
    const process = spawn('inotifywait', [
      '-r',
      '-m',
      '-e', 'modify,create,delete,move',
      '--exclude', '(node_modules|\.git|\.kagent|dist|build|\.next)',
      this.workspaceRoot,
    ]);

    let buffer = '';

    process.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        this.handleFileEvent(line);
      }
    });

    process.stderr.on('data', (data) => {
      // Ignore inotifywait output
    });

    process.on('close', () => {
      console.log(`${colors.yellow}Watcher stopped${colors.reset}`);
    });

    process.on('error', (err) => {
      console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
    });
  }

  // Watch using polling (cross-platform)
  watchWithPolling() {
    const checkInterval = 1000;
    
    // Store file states
    const fileStates = new Map();

    const checkFiles = () => {
      try {
        const output = execSync(`find ${this.workspaceRoot} -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.kagent/*" -not -path "*/dist/*" -not -path "*/build/*"`, { encoding: 'utf8' });
        
        const files = output.split('\n').filter(f => f && !this.shouldIgnore(f));
        
        for (const file of files) {
          try {
            const stat = statSync(file);
            const prev = fileStates.get(file);
            
            if (!prev) {
              // New file
              fileStates.set(file, stat.mtimeMs);
              const content = readFileSync(file, 'utf8');
              this.recordChange(file, '', content, 'onSave', 'agent');
            } else if (stat.mtimeMs !== prev) {
              // Modified file
              const oldContent = this.lastRecordedContent.get(file) || '';
              const newContent = readFileSync(file, 'utf8');
              this.recordChange(file, oldContent, newContent, 'onSave', 'agent');
              this.lastRecordedContent.set(file, newContent);
              fileStates.set(file, stat.mtimeMs);
            }
          } catch {
            // File might have been deleted
          }
        }
      } catch {
        // Ignore errors
      }
    };

    // Initial scan
    checkFiles();

    // Start polling
    setInterval(checkFiles, checkInterval);
  }

  // Handle file event from inotifywait
  handleFileEvent(line) {
    // Parse inotifywait output
    const match = line.match(/(\S+)\s+(\S+)\s+(MODIFY|CREATE|DELETE|MOVE)\s+(.+)/);
    if (!match) return;

    const [, dir, file, action, filename] = match;
    const fullPath = join(dir, filename || file);

    if (this.shouldIgnore(fullPath)) return;

    try {
      if (action === 'DELETE' || action === 'MOVE') {
        // File deleted or moved - mark as delisted
        const relativePath = relative(this.workspaceRoot, fullPath);
        const symbols = JSON.parse(readFileSync(this.symbolsPath, 'utf8'));
        if (symbols.symbols[relativePath]) {
          symbols.symbols[relativePath].delisted = true;
          symbols.symbols[relativePath].delisted_at = Date.now();
          writeFileSync(this.symbolsPath, JSON.stringify(symbols, null, 2));
          console.log(`${colors.red}ST ${colors.reset} ${relativePath} delisted`);
        }
      } else {
        // File created or modified
        const content = readFileSync(fullPath, 'utf8');
        const oldContent = this.lastRecordedContent.get(fullPath) || '';
        const result = this.recordChange(fullPath, oldContent, content, 'onSave', 'agent');
        
        if (result.recorded) {
          this.lastRecordedContent.set(fullPath, content);
          const event = result.event;
          const trendIcon = event.net > 0 ? 
            (this.colorScheme === 'cn' ? colors.red : colors.green) : 
            event.net < 0 ? 
            (this.colorScheme === 'cn' ? colors.green : colors.red) : 
            colors.gray;
          console.log(`${trendIcon}${event.net > 0 ? '▲' : event.net < 0 ? '▼' : '─'}${colors.reset} ${event.file} ${colors.gray}(${event.lines_before} → ${event.lines_after})${colors.reset}`);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  // Show help
  showHelp() {
    console.log(`
${colors.bold}${colors.magenta}╔══════════════════════════════════════════╗${colors.reset}
${colors.bold}${colors.magenta}║  KKK - 文件变更 K 线追踪器 (CLI版)      ║${colors.reset}
${colors.bold}${colors.magenta}║  Claude Code / OpenCode / MiMoCode     ║${colors.reset}
${colors.bold}${colors.magenta}╚══════════════════════════════════════════╝${colors.reset}

${colors.bold}Usage:${colors.reset}
  ${colors.cyan}kagent init${colors.reset}          Initialize KAgent in current directory
  ${colors.cyan}kagent market${colors.reset}        Show all tracked files (market view)
  ${colors.cyan}kagent chart <file>${colors.reset}  Show K-line chart for a file
  ${colors.cyan}kagent watch${colors.reset}         Watch for file changes and record
  ${colors.cyan}kagent record${colors.reset}        Record a file change (for hooks)
  ${colors.cyan}kagent kkk${colors.reset}           One-click start (init + watch)
  ${colors.cyan}kagent help${colors.reset}          Show this help message

${colors.bold}Quick Start:${colors.reset}
  ${colors.gray}# In your project directory:${colors.reset}
  kagent init
  kagent watch &

  ${colors.gray}# Or use one-click start:${colors.reset}
  kagent kkk

${colors.bold}Examples:${colors.reset}
  kagent init
  kagent watch
  kagent market
  kagent chart src/index.js

${colors.bold}Options:${colors.reset}
  --color-scheme <cn|us>  Set color scheme (default: cn)
  --help                  Show help
`);
  }

  // Parse arguments and run
  run() {
    const args = process.argv.slice(2);
    const command = args[0];

    // Check for color scheme option
    const colorSchemeIdx = args.indexOf('--color-scheme');
    if (colorSchemeIdx !== -1 && args[colorSchemeIdx + 1]) {
      this.colorScheme = args[colorSchemeIdx + 1];
    }

    switch (command) {
      case 'init':
        this.init();
        break;
      case 'market':
        this.showMarket();
        break;
      case 'chart':
        if (!args[1]) {
          console.log(`${colors.red}Please specify a file${colors.reset}`);
          console.log(`${colors.gray}Usage: kagent chart <file>${colors.reset}`);
          process.exit(1);
        }
        this.showChart(args[1]);
        break;
      case 'watch':
        this.init();
        this.watch();
        break;
      case 'record': {
        // Hook 回调: kagent record --file <path> --root <path>
        const fileIdx = args.indexOf('--file');
        const rootIdx = args.indexOf('--root');
        const file = fileIdx !== -1 ? args[fileIdx + 1] : null;
        const root = rootIdx !== -1 ? args[rootIdx + 1] : process.cwd();
        if (file) {
          const absPath = file.startsWith('/') ? file : join(root, file);
          if (existsSync(absPath)) {
            const content = readFileSync(absPath, 'utf8');
            const relPath = relative(root, absPath);
            const old = this.lastRecordedContent.get(absPath) || '';
            this.recordChange(absPath, old, content, 'onSave', 'agent');
            this.lastRecordedContent.set(absPath, content);
          }
        }
        break;
      }
      case 'kkk':
      case 'start':
        // 一键启动: 初始化 + 监听
        this.init();
        console.log(`${colors.cyan}KKK 正在监听文件变更...${colors.reset}`);
        this.watch();
        break;
      case 'help':
      case '--help':
      case '-h':
        this.showHelp();
        break;
      default:
        this.showHelp();
    }
  }
}

// Run CLI
const cli = new KagentCLI();
cli.run();
