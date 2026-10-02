#!/usr/bin/env bash
# 質問フォームの通知先などを Cloudflare Pages（kaishi-lab）の環境変数（Secrets）に入れる
# ~/.secrets/kaishi.env から読む。書いてあるものだけを設定する（どれも Git 管理外）:
#   RESEND_KAISHI_API_KEY      → RESEND_API_KEY     … Resend の送信用キー
#   ASK_KAISHI_TO              → ASK_TO             … メールの送り先（学部の窓口など。先生のアドレスが未登録のとき）
#   ASK_KAISHI_FROM            → ASK_FROM           … 送信元（Resend で認証したドメインのアドレス）
#   ASK_KAISHI_TEACHER_EMAILS  → TEACHER_EMAILS     … {"shirai-akihiko":"...@kaishi.ac.jp"} の JSON
#   ASK_KAISHI_SLACK_WEBHOOK   → SLACK_WEBHOOK_URL
#   ASK_KAISHI_DISCORD_WEBHOOK → DISCORD_WEBHOOK_URL
#   ASK_KAISHI_TEAMS_WEBHOOK   → TEAMS_WEBHOOK_URL
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=${KAISHI_ENV:-$HOME/.secrets/kaishi.env}
[[ -f $ENV_FILE ]] || { echo "$ENV_FILE がありません" >&2; exit 1; }
val() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -E "s/^[\"']|[\"']\$//g"; }
export CLOUDFLARE_API_TOKEN=$(val CLOUDFLARE_KAISHI_API_TOKEN)
export CLOUDFLARE_ACCOUNT_ID=$(val CLOUDFLARE_KAISHI_ACCOUNT_ID)

set_secret() {
  local from=$1 to=$2 v
  v=$(val "$from")
  if [[ -n $v ]]; then
    printf '%s' "$v" | pnpm exec wrangler pages secret put "$to" --project-name kaishi-lab >/dev/null
    echo "  $to を設定"
  fi
}
set_secret RESEND_KAISHI_API_KEY RESEND_API_KEY
set_secret ASK_KAISHI_TO ASK_TO
set_secret ASK_KAISHI_FROM ASK_FROM
set_secret ASK_KAISHI_TEACHER_EMAILS TEACHER_EMAILS
set_secret ASK_KAISHI_SLACK_WEBHOOK SLACK_WEBHOOK_URL
set_secret ASK_KAISHI_DISCORD_WEBHOOK DISCORD_WEBHOOK_URL
set_secret ASK_KAISHI_TEAMS_WEBHOOK TEAMS_WEBHOOK_URL
echo "完了。次のデプロイから有効になります"
