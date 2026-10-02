#!/usr/bin/env bash
# 手元から Cloudflare Pages に公開する（通常は GitHub Actions が行う）
#   ./scripts/deploy.sh            # 今のブランチ名でプレビュー公開（main なら本番）
#   ./scripts/deploy.sh preview    # ブランチ名を指定
# 認証情報は大学（Kaishi-info）の Cloudflare アカウントのもの。次の順で探す（どちらも Git 管理外）:
#   ~/.secrets/kaishi.env  /  .secrets/kaishi.env
#   CLOUDFLARE_KAISHI_API_TOKEN=...   # 権限: Account / Cloudflare Pages / Edit
#   CLOUDFLARE_KAISHI_ACCOUNT_ID=...
# AICU など別組織のアカウントには公開しない（wrangler のログイン状態は使わない）
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=${KAISHI_ENV:-}
for f in "$HOME/.secrets/kaishi.env" .secrets/kaishi.env; do
  [[ -z $ENV_FILE && -f $f ]] && ENV_FILE=$f
done
if [[ -z $ENV_FILE ]]; then
  echo "kaishi.env が見つかりません（~/.secrets/kaishi.env に大学の Cloudflare の API トークンを入れてください）" >&2
  exit 1
fi
# 必要な 2 つだけを読む（同じファイルの他の秘密は環境に出さない）
val() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -E 's/^["'\'']|["'\'']$//g'; }
export CLOUDFLARE_API_TOKEN=$(val CLOUDFLARE_KAISHI_API_TOKEN)
export CLOUDFLARE_ACCOUNT_ID=$(val CLOUDFLARE_KAISHI_ACCOUNT_ID)
if [[ -z $CLOUDFLARE_API_TOKEN || -z $CLOUDFLARE_ACCOUNT_ID ]]; then
  echo "$ENV_FILE に CLOUDFLARE_KAISHI_API_TOKEN / CLOUDFLARE_KAISHI_ACCOUNT_ID がありません" >&2
  exit 1
fi

PROJECT=kaishi-lab
BRANCH=${1:-$(git branch --show-current)}

# プロジェクトが無ければ作る（初回のみ）
if ! pnpm exec wrangler pages project list 2>/dev/null | grep -q " $PROJECT "; then
  pnpm exec wrangler pages project create "$PROJECT" --production-branch main --force  # --force: 新しい「Workers に統合された Pages」ではなく pages.dev の従来 Pages として作る
fi

pnpm build
pnpm exec wrangler pages deploy dist --project-name "$PROJECT" --branch "$BRANCH" --commit-dirty=true
