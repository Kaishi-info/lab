# AGENTS.md — teachers で作業する人と AI エージェントへ

このファイルは、このリポジトリで作業する **人間と AI エージェント（Claude Code / Codex / Cursor / Copilot など）共通のルール** です。
AI エージェントは作業を始める前に必ず全文を読んでください。

> Claude Code では `CLAUDE.md` がこのファイルを読み込みます。ルールの正本はこの AGENTS.md です。

## 1. このリポジトリは何か

- 開志創造大学 情報デザイン学部の **先生が自分で更新する教員ページ**（公開予定: https://lab.kaishi.ac.jp）
- **公開リポジトリ** です。ここに入れたものは誰でも読めます。
- 使い方・項目の一覧は [README.md](README.md)

## 2. ファイルの持ち主（いちばん大事）

| 場所 | 書く人 | ルール |
|---|---|---|
| `teachers/<ID>.yaml` | **その先生本人** | 先生の依頼で、その先生のファイルだけを編集する。他の先生のファイルは触らない |
| `data/official/` | `pnpm scrape`（機械） | 手で編集しない |
| `data/feeds/` | `pnpm feeds`（機械） | 手で編集しない |
| `src/`, `scripts/`, `.github/` | 開発者 | サイトの見た目・仕組み。先生のページ編集の PR に混ぜない |

- 先生から「ページを直して」と頼まれたら、変更は原則 `teachers/<その先生のID>.yaml` の 1 ファイルで完結させる。
- 項目が足りないときは、`src/content.config.ts` に項目を足す **別の PR** を提案する。

## 3. 公開してはいけないもの

- **評価シート（xlsx）・点数・教員平均・評価者コメント**。`pnpm import-eval` は本人コメントだけを `.private/` に出す。`.private/` と `*.xlsx` はコミットしない
- **未公開のシラバス原文**（NeKo-PoC など非公開リポジトリにある資料）。先生本人が「載せてよい」と言った部分だけを、要約して `courses` に書く
- 学生の個人情報、個人のメールアドレス・電話番号（先生本人が明示的に載せたいもの以外）
- API キー・トークンなどの秘密の値
- 権利のはっきりしない画像

迷ったら載せずに、先生に確認する。

## 4. 作業の流れ

1. 依頼は Issue にする（`gh issue create -R Kaishi-info/lab ...`）。既存の Issue があればそこにコメント
2. ブランチを作る: `<種類>/<Issue番号>-<説明>`（例: `page/12-shirai-office-hours`, `feat/13-search`）
3. 変更したら必ず確認する:
   ```bash
   pnpm build   # YAML の書き間違いはここでエラーになる
   pnpm check   # 型チェック（src/ を変えたとき）
   ```
4. PR を作る（本文に `Closes #番号`、テンプレートに沿って）。**マージは人間が行う**
5. 先生に、平易な日本語で「何をしたか / 開く URL / お願いしたいこと」を報告する

## 5. 先生の YAML を書くときの注意

- 時刻は `"18:00"` のように **引用符で囲む**（囲まないと YAML が数値として読む）
- 曜日は `月 火 水 木 金 土 日 随時` のどれか
- 日付は `2026-10-01` の形
- 先生の文章は先生の言葉のまま。AI が言い換えた場合は、PR で「言い換えた」と明記する
- 雛形のコメント（`# ...`）は消さなくてよい

## 6. 相手は GitHub に不慣れ、と想定する

- Git の操作は AI が代行する。先生にはブラウザで開く URL を渡す
- 専門用語は最初の 1 回だけ括弧で説明する（例:「PR（変更を見てもらう申請）」）
- 取り返しのつかない操作（`git push --force`、ファイル削除、`gh repo edit` など）は事前に確認する

## 7. 技術メモ

- Astro（静的サイト）。データは YAML を Content Collections で読む（`src/content.config.ts`）
- 公開先: Cloudflare Pages（大学のアカウント、プロジェクト kaishi-lab）。`deploy.yml` が main への push で本番、PR ごとにプレビュー。サイト内リンクは必ず `href()` を通す
- 質問フォーム（/ask/）の送信は `functions/api/ask.ts`（Pages Functions）→ Resend / Slack / Discord / Teams。メールアドレスや Webhook URL は Pages の環境変数にだけ置き、リポジトリに書かない
- 科目一覧は `pnpm import-curriculum <CSV>` で data/curriculum.yaml に変換する。CSV 本体とオフィスアワーの原文（内部メモが混ざる）はコミットしない
- `watch.yml` が毎日 03:00 JST に公式サイトと researchmap・RSS を取り込む
- パッケージ管理は pnpm。Node 24 以上（`scripts/*.ts` は Node で直接実行）
- デザイン: グラスモーフィズム。色などは `src/styles/global.css` の先頭の CSS 変数にまとまっている。スマホ（375px）で崩れないことを確認する
