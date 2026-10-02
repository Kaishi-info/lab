#!/usr/bin/env bash
# 「先生に聞いてみる」の送信用 Worker（workers/ask）をデプロイし、Secrets を入れる
# ~/.secrets/kaishi.env から読む（どれも Git 管理外）:
#   CLOUDFLARE_KAISHI_API_TOKEN / CLOUDFLARE_KAISHI_ACCOUNT_ID … 大学の Cloudflare（Workers Scripts: Edit が必要）
#   RESEND_KAISHI_API_KEY … Resend の送信用キー
#   ASK_KAISHI_TO         … 先生のアドレスが未登録のときの送り先（学部の窓口など）
#   ASK_KAISHI_TEACHER_EMAILS … {"slug":"address"} の JSON（任意）
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=${KAISHI_ENV:-$HOME/.secrets/kaishi.env}
[[ -f $ENV_FILE ]] || { echo "$ENV_FILE がありません" >&2; exit 1; }
val() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -E "s/^[\"']|[\"']\$//g"; }
export CLOUDFLARE_API_TOKEN=$(val CLOUDFLARE_KAISHI_API_TOKEN)
export CLOUDFLARE_ACCOUNT_ID=$(val CLOUDFLARE_KAISHI_ACCOUNT_ID)
RESEND=$(val RESEND_KAISHI_API_KEY)
TO=$(val ASK_KAISHI_TO)
EMAILS=$(val ASK_KAISHI_TEACHER_EMAILS)
[[ -n $RESEND && -n $TO ]] || { echo "$ENV_FILE に RESEND_KAISHI_API_KEY と ASK_KAISHI_TO を入れてください" >&2; exit 1; }

W="pnpm exec wrangler -c workers/ask/wrangler.jsonc"
$W deploy
printf '%s' "$RESEND" | $W secret put RESEND_API_KEY
printf '%s' "$TO" | $W secret put ASK_TO
[[ -n $EMAILS ]] && printf '%s' "$EMAILS" | $W secret put TEACHER_EMAILS
echo "完了。サイトのビルド時に PUBLIC_ASK_ENDPOINT に上の URL を設定してください（.github/workflows/deploy.yml）"
