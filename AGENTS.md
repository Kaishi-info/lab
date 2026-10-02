# AGENTS.md — lab で作業する人と AI エージェントへ

このファイルは、このリポジトリで作業する **人間と AI エージェント（Claude Code / Codex / Cursor / Copilot など）共通のルール** です。
AI エージェントは作業を始める前に必ず全文を読んでください。

> Claude Code では `CLAUDE.md` がこのファイルを読み込みます。ルールの正本はこの AGENTS.md です。
> 先生向けの説明（どこを編集するか）は [README.md](README.md) にあります。

## 1. このリポジトリは何か

- 開志創造大学 情報デザイン学部の **先生が自分で更新する教員ページ**（https://kaishi-lab.pages.dev 、のちに https://lab.kaishi.ac.jp ）
- 主語は「この先生は何者か」ではなく **「この先生と何を学び、何を作れるか」**。抽象的な言葉より、授業・課題・作品・プロジェクトなどの具体物を載せる
- **公開リポジトリ** です。ここに入れたものは誰でも読めます

## 2. ファイルの持ち主（いちばん大事）

| 場所 | 書く人 | ルール |
|---|---|---|
| `teachers/<ID>.yaml` | **その先生本人** | 先生の依頼で、その先生のファイルだけを編集する。他の先生のファイルは触らない |
| `data/official/` | `pnpm scrape`（機械） | 手で編集しない（公式サイトが元） |
| `data/curriculum.yaml` | `pnpm import-curriculum`（機械） | 手で編集しない（教務の科目一覧 CSV が元） |
| `data/feeds/` | `pnpm feeds`（機械） | 手で編集しない（researchmap・RSS が元） |
| `src/`, `functions/`, `scripts/`, `.github/` | 開発者 | サイトの見た目・仕組み。先生のページ編集の PR に混ぜない |
| `src/lib/taxonomy.ts` | 教務・カリキュラム担当 | 学部の領域（clusters）・立場別の入口の定義 |
| `strategy.md`（あれば） | 学部執行部 | 非公開の方針文書（.gitignore 済み）。手元にあれば読んで方針に従う。内容を公開の場所に書かない |

## 3. 先生から頼まれたときの手順

1. **だれのページか確かめる**。ID は公式サイトの URL の末尾（`.../teacher/shirai-akihiko/` → `shirai-akihiko`）。README の先生一覧にもある
2. **Issue を探す・作る**。Issue フォーム（ラベル `page-update`）で届いた依頼なら、その Issue をそのまま使う
3. ブランチを作る: `page/<Issue番号>-<ID>`（例: `page/12-shirai-akihiko`）
4. `teachers/<ID>.yaml` **だけ** を編集する。雛形の `# ` を外して書く（下の対応表）
5. `pnpm build` で確かめる（YAML の書き間違いはここでエラーになる）
6. PR を作る（本文に `Closes #番号`）。プレビュー URL が PR に自動でコメントされるので、それを先生に渡す
7. 先生に平易な日本語で報告する: **何をしたか / 開く URL（プレビュー）/ お願いしたいこと**。マージは人間が行う

### 依頼の言葉 → YAML の項目

| 先生の言葉 | 項目 | 注意 |
|---|---|---|
| X・Bluesky・Instagram・note を載せて | `x` / `bluesky` / `instagram` / `note` | @ なしの ID。`x: o_ob` |
| YouTube・LinkedIn・ポートフォリオ・CV サイト | `youtube` / `linkedin` / `portfolio` / `website` | URL |
| GitHub | `github` | ユーザー名だけ |
| researchmap | `researchmap` | `https://researchmap.jp/<ここ>/` の部分。業績は毎日自動で取り込まれる |
| ブログ・note の新着を出したい | `feeds` | RSS / Atom の URL |
| オフィスアワーを変えたい | `officeHours` | `day`（月〜日・随時）、`start` / `end` は `"18:00"` のように引用符で。書くと科目一覧の時間より優先 |
| ひとこと・キャッチコピー | `catchcopy` | 60 字まで。「○○を使って、○○をできるようにする」の形を提案するとよい |
| 何が学べるか | `learn` | 3〜5 項目 |
| 授業の作るもの・課題・スライド | `courses` | `name` を科目一覧の科目名と完全に同じにする（同じなら科目一覧の情報に書き足される） |
| 研究テーマ | `researchThemes` | |
| プロジェクト・社会連携 | `projects` | `kind` は 研究 / 制作 / 社会実装 / PBL / 展示 / イベント |
| 学生の作品 | `works` | **学生の氏名は本人の同意を先生に確認してから** |
| 学生へのメッセージ | `message` / `lookingFor` / `consult` / `careers` | |
| 高校生へ・企業へなど | `audiences` | キーは `high-school` `adult` `vocational` `overseas` `parents` `school-teachers` `companies` `researchers` |
| ゼミ生募集・共同研究の窓口 | `join` | `type` は 授業 / ゼミ / 研究 / プロジェクト / 高大連携 / 共同研究 / 取材・講演 |
| 最近のトピック | `topics` | `date` は `2026-10-01` の形 |
| 写真を変えたい | `photo` | 画像は `public/photos/` に置いて `/photos/xxx.jpg`。権利を確認する |
| 公式サイトの経歴・氏名が違う | （YAML ではない） | 公式サイト側の修正を案内する。`data/official/` は直さない |
| 担当科目が違う | （YAML ではない） | 教務の科目一覧の修正を案内する |
| 一覧に出したくない | `hidden: true` | |

項目が足りないときは、`src/content.config.ts` に項目を足す **別の PR** を提案する（先生の PR に混ぜない）。

## 4. 公開してはいけないもの

- **評価シート（xlsx）・点数・教員平均・評価者コメント**。`pnpm import-eval` は本人コメントだけを `.private/` に出す。`.private/` と `*.xlsx` はコミットしない
- **未公開のシラバス原文**（NeKo-PoC など非公開リポジトリにある資料）。先生本人が「載せてよい」と言った部分だけを、要約して `courses` に書く
- **科目一覧 CSV の原文**（オフィスアワー欄に内部メモが混ざる）。`pnpm import-curriculum` は曜日・時刻だけを保存する
- **非公開の方針文書**（`strategy.md`）の内容
- 学生の個人情報、個人のメールアドレス・電話番号（先生本人が載せたいと決めたもの以外）
- API キー・トークン・Webhook URL などの秘密の値（Cloudflare Pages / GitHub の Secrets にだけ置く）
- 権利のはっきりしない画像

迷ったら載せずに、先生に確認する。

## 5. 先生の YAML を書くときの注意

- 先生の文章は先生の言葉のまま。AI が言い換えた・下書きした場合は、PR で「AI の下書き」と明記して確認してもらう
- 時刻は `"18:00"` のように **引用符で囲む**（囲まないと YAML が数値として読む）。日付は `2026-10-01`
- 雛形のコメント（`# ...`）は消さなくてよい
- 書いた項目だけがページに出る。空の項目を埋めるためにそれらしい内容を作らない

## 6. 相手は GitHub に不慣れ、と想定する

- Git の操作は AI が代行する。先生にはブラウザで開く URL を渡す
- 専門用語は最初の 1 回だけ括弧で説明する（例:「PR（変更を見てもらう申請）」）
- 取り返しのつかない操作（`git push --force`、ファイル削除、`gh repo edit` など）は事前に確認する
- `gh pr merge` は実行しない（マージは人間）

## 7. 開発するとき

1. 依頼は Issue にする（`gh issue create -R Kaishi-info/lab ...`）
2. ブランチ: `<種類>/<Issue番号>-<説明>`（例: `feat/13-search`）
3. 確かめる: `pnpm build`（YAML 検証込み）・`pnpm check`（型）。見た目を変えたらスマホ幅（375px）と PC 幅の両方を見る
4. PR（`Closes #番号`）。プレビュー URL で確認してもらう

### 技術メモ

- Astro（静的サイト）。データは YAML を Content Collections で読む（`src/content.config.ts`）。先生 1 人分のまとめは `src/lib/teachers.ts`
- 公開先: Cloudflare Pages（大学のアカウント、プロジェクト `kaishi-lab`）。`deploy.yml` が main への push で本番、PR ごとにプレビュー。サイト内リンクは必ず `href()` を通す
- 質問フォーム（/ask/）の送信は `functions/api/ask.ts`（Pages Functions）→ Resend / Slack / Discord / Teams。入口は `PUBLIC_ASK_ENABLED=true` のときだけ表示（#2）
- 科目一覧は `pnpm import-curriculum <CSV>`、公式サイトは `pnpm scrape`、researchmap・RSS は `pnpm feeds`。`watch.yml` が毎日 03:00 JST に scrape と feeds を実行する
- パッケージ管理は pnpm。Node 24 以上（`scripts/*.ts` は Node で直接実行）
- デザイン: グラスモーフィズム。色などは `src/styles/global.css` の先頭の CSS 変数。日本語は `word-break: auto-phrase`
