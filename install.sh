#!/bin/bash

# ============================================================
#  KKK 一键安装脚本
#  支持: Claude Code / OpenCode / MiMoCode
# ============================================================

set -e

REPO_URL="git@github.com:zhangjiabo522/KKK.git"
INSTALL_DIR="$HOME/.kkk"
BIN_DIR="$HOME/.local/bin"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║        KKK - 文件变更 K 线追踪器         ║${NC}"
echo -e "${CYAN}${BOLD}║   Claude Code / OpenCode / MiMoCode     ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

# ─── 检查 Node.js ───
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js 未安装，请先安装 Node.js${NC}"
    exit 1
fi
NODE_VER=$(node -v)
echo -e "${GREEN}✓${NC} Node.js ${NODE_VER}"

# ─── 克隆仓库 ───
echo ""
echo -e "${YELLOW}▸ 克隆 KKK 仓库...${NC}"

if [ -d "$INSTALL_DIR" ]; then
    echo -e "${GREEN}✓${NC} 已存在 $INSTALL_DIR，更新中..."
    cd "$INSTALL_DIR" && git pull --rebase 2>/dev/null || true
else
    git clone "$REPO_URL" "$INSTALL_DIR"
fi

# ─── 安装 npm link ───
echo -e "${YELLOW}▸ 安装 kagent 命令...${NC}"
cd "$INSTALL_DIR"
npm link 2>/dev/null

# ─── 确保 BIN_DIR 在 PATH 中 ───
mkdir -p "$BIN_DIR"
if ! echo "$PATH" | grep -q "$BIN_DIR"; then
    echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$HOME/.bashrc"
    echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$HOME/.zshrc" 2>/dev/null || true
    export PATH="$BIN_DIR:$PATH"
fi

# ─── 创建 /KKK 命令入口 ───
echo -e "${YELLOW}▸ 创建 /KKK 命令...${NC}"

# Claude Code hook 设置
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
if [ -f "$CLAUDE_SETTINGS" ]; then
    # 添加 hook 到 Claude Code settings
    python3 -c "
import json, os
path = os.path.expanduser('$CLAUDE_SETTINGS')
with open(path) as f:
    data = json.load(f)
hooks = data.get('hooks', {})
# 添加 afterEdit hook
if 'afterEdit' not in hooks:
    hooks['afterEdit'] = {}
hooks['afterEdit']['command'] = 'kagent record --file \"\$FILE\" --root \"\$ROOT\"'
# 添加 afterSave hook
if 'afterSave' not in hooks:
    hooks['afterSave'] = {}
hooks['afterSave']['command'] = 'kagent record --file \"\$FILE\" --root \"\$ROOT\"'
data['hooks'] = hooks
with open(path, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print('  Claude Code hooks configured')
" 2>/dev/null && echo -e "${GREEN}✓${NC} Claude Code hooks 已配置" || echo -e "${YELLOW}!${NC} Claude Code settings.json 跳过（稍后手动配置）"
fi

# MiMoCode hook 设置
MIMO_SETTINGS="$HOME/.config/mimocode/settings.json"
if [ -d "$HOME/.config/mimocode" ]; then
    python3 -c "
import json, os
path = os.path.expanduser('$MIMO_SETTINGS')
if os.path.exists(path):
    with open(path) as f:
        data = json.load(f)
else:
    data = {}
hooks = data.get('hooks', {})
hooks['afterEdit'] = 'kagent record --file \"\$FILE\" --root \"\$ROOT\"'
hooks['afterSave'] = 'kagent record --file \"\$FILE\" --root \"\$ROOT\"'
data['hooks'] = hooks
with open(path, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print('  MiMoCode hooks configured')
" 2>/dev/null && echo -e "${GREEN}✓${NC} MiMoCode hooks 已配置" || echo -e "${YELLOW}!${NC} MiMoCode 配置跳过"
fi

# ─── 完成 ───
echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✓ 安装完成！${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════${NC}"
echo ""
echo -e "  使用方法:"
echo ""
echo -e "  ${CYAN}1. 在项目目录初始化:${NC}"
echo -e "     kagent init"
echo ""
echo -e "  ${CYAN}2. 启动自动监听:${NC}"
echo -e "     kagent watch"
echo ""
echo -e "  ${CYAN}3. 查看市场:${NC}"
echo -e "     kagent market"
echo ""
echo -e "  ${CYAN}4. 查看 K 线图:${NC}"
echo -e "     kagent chart <文件路径>"
echo ""
echo -e "  ${CYAN}5. 一键启动（自动初始化+监听）:${NC}"
echo -e "     kkk"
echo ""
echo -e "  ${YELLOW}提示: 在 Claude Code 中输入 /KKK 即可一键启动${NC}"
echo ""

# ─── 创建 kkk 命令 ───
cat > /usr/local/bin/kkk 2>/dev/null << 'KKK_EOF' || cat > "$BIN_DIR/kkk" 2>/dev/null << 'KKK_EOF' || true
#!/bin/bash
# KKK 一键启动命令
cd "$(pwd)"
kagent init 2>/dev/null
echo ""
echo -e "\033[0;36m  正在启动 KKK 文件追踪...\033[0m"
echo ""
kagent watch &
KKK_PID=$!
echo -e "\033[0;32m  ✓ KKK 已启动 (PID: $KKK_PID)\033[0m"
echo -e "\033[0;32m  ✓ 正在监听当前目录的文件变更\033[0m"
echo -e "\033[0;32m  ✓ 使用 'kagent market' 查看市场\033[0m"
echo -e "\033[0;32m  ✓ 使用 'kagent chart <file>' 查看K线图\033[0m"
echo -e "\033[0;32m  ✓ 按 Ctrl+C 停止监听\033[0m"
echo ""
echo -e "\033[0;90m  [KKK] $KKK_PID\033[0m" > .kkk.pid
wait $KKK_PID
KKK_EOF
chmod +x /usr/local/bin/kkk 2>/dev/null || chmod +x "$BIN_DIR/kkk" 2>/dev/null || true

echo -e "${GREEN}✓${NC} /KKK 命令已安装"
