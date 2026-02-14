#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# publish-to-public.sh
#
# private (origin=monchart) の main ブランチから
# 設計ドキュメントを除外して public (monapochi/mochart) へ push する。
#
# Usage:
#   ./tools/publish-to-public.sh          # main を公開
#   ./tools/publish-to-public.sh v0.1.0   # タグ付きリリース
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# ── 除外対象: 設計ドキュメント (公開したくないファイル) ──────────
PRIVATE_FILES=(
  "REFACTORING_PLAN.md"
  "COMPETITIVE_ANALYSIS.md"
  "PLAN.md"
  "chart_indicator_spec.md"
  "tools/publish-to-public.sh"
  "tools/fetch_msft.py"
  "fixtures/"
)

PUBLIC_REMOTE="public"
SOURCE_BRANCH="main"
TAG="${1:-}"

echo "📦 Publishing ${SOURCE_BRANCH} to ${PUBLIC_REMOTE}..."
echo ""

# ── 作業用の一時ブランチを作成 ─────────────────────────────────
TEMP_BRANCH="__public_staging_$$"

# 現在のブランチを保存
ORIGINAL_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD)"

cleanup() {
  git checkout "$ORIGINAL_BRANCH" 2>/dev/null || true
  git branch -D "$TEMP_BRANCH" 2>/dev/null || true
}
trap cleanup EXIT

# main から一時ブランチを作成
git checkout -b "$TEMP_BRANCH" "$SOURCE_BRANCH"

# ── 設計ドキュメントを削除 ─────────────────────────────────────
for f in "${PRIVATE_FILES[@]}"; do
  if [ -e "$f" ]; then
    git rm -rf "$f" --quiet 2>/dev/null || true
    echo "  🚫 excluded: $f"
  fi
done

# ── 除外分をコミット ───────────────────────────────────────────
git commit -m "chore: prepare public release (exclude private docs)" --allow-empty --quiet

# ── public リモートに push ─────────────────────────────────────
git push "$PUBLIC_REMOTE" "${TEMP_BRANCH}:main" --force
echo ""
echo "✅ Pushed to ${PUBLIC_REMOTE} (main)"

# ── タグがあれば push ──────────────────────────────────────────
if [ -n "$TAG" ]; then
  git tag -f "$TAG"
  git push "$PUBLIC_REMOTE" "$TAG" --force
  echo "🏷  Tagged: $TAG"
fi

echo ""
echo "🔗 https://github.com/monapochi/mochart"
