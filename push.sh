#!/bin/bash

# ═══════════════════════════════════════════
#  KKK 推送脚本
#  将项目推送到 GitHub
# ═══════════════════════════════════════════

set -e

REPO_URL="git@github.com:zhangjiabo522/KKK.git"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "═══════════════════════════════════════════"
echo "  KKK 推送到 GitHub"
echo "═══════════════════════════════════════════"
echo ""

cd "$REPO_DIR"

# 检查是否是 git 仓库
if [ ! -d ".git" ]; then
    echo "初始化 git 仓库..."
    git init
    git branch -m main
fi

# 添加远程仓库
if ! git remote get-url origin &>/dev/null; then
    git remote add origin "$REPO_URL"
fi

# 推送
echo "推送到 $REPO_URL ..."
git push -u origin main

echo ""
echo "✓ 推送完成!"
echo ""
echo "仓库地址: https://github.com/zhangjiabo522/KKK"
echo ""
