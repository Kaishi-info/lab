#!/usr/bin/env bash
# 手元から Cloudflare Pages に公開する（通常は GitHub Actions が行う）
#   ./scripts/deploy.sh            # 今のブランチ名でプレビュー公開（main なら本番）
#   ./scripts/deploy.sh preview    # ブランチ名を指定
# 認証情報は .secrets/kaishi.env（Git 管理外）から読む:
#   CLOUDFLARE_API_TOKEN=...   # 権限: Account / Cloudflare Pages / Edit
#   CLOUDFLARE_ACCOUNT_ID=...
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=.secrets/kaishi.env
if [[ ! -f $ENV_FILE ]]; then
  echo "$ENV_FILE がありません（大学の Cloudflare アカウントの API トークンを入れてください）" >&2
  exit 1
fi
set -a; source "$ENV_FILE"; set +a

PROJECT=kaishi-lab
BRANCH=${1:-$(git branch --show-current)}

# プロジェクトが無ければ作る（初回のみ）
if ! pnpm exec wrangler pages project list 2>/dev/null | grep -q " $PROJECT "; then
  pnpm exec wrangler pages project create "$PROJECT" --production-branch main
fi

pnpm build
pnpm exec wrangler pages deploy dist --project-name "$PROJECT" --branch "$BRANCH" --commit-dirty=true
