# lab — 情報デザイン学部 先生たちのページ

開志創造大学 情報デザイン学部の先生が、**自分で書いて更新する** 教員ページです。
研究室、オフィスアワー、最近のトピック、相談しにきてほしい学生へのメッセージなどを載せます。

- 公開予定: https://lab.kaishi.ac.jp
- 公式の教員紹介: https://kaishi.ac.jp/info-d/teacher/ （氏名・職歴などはここから自動で取り込みます）

## 自分のページを編集する

編集するのは **`teachers/<自分のID>.yaml` の 1 ファイルだけ** です（例: [`teachers/shirai-akihiko.yaml`](teachers/shirai-akihiko.yaml)）。
ID は公式サイトの URL の最後の部分（`.../teacher/shirai-akihiko/`）と同じです。

### いちばん簡単な方法（ブラウザだけ）

1. 自分のページの一番下にある「GitHub で編集する」を押す（または GitHub で `teachers/<ID>.yaml` を開いて鉛筆アイコン）
2. 書きたい項目の先頭の `# ` を消して、内容を書き換える
3. 「Commit changes」→「Propose changes」→「Create pull request」
4. 自動チェックが通れば、レビューのあとで公開されます

### AI に頼む方法

Claude Code などの AI エージェントに「AGENTS.md を読んでから、私のページにオフィスアワーを追加して」のように頼めます。
Git の操作も AI が代わりに行います。

### 書ける項目

```yaml
researchmap: akihiko            # https://researchmap.jp/<ここ>/ → 論文・発表などが「最近の活動」に自動で載る
x: your_handle                  # X(Twitter) の ID（@なし）。リンクを表示します
website: https://example.com    # 研究室サイト・CVサイト
feeds:                          # ブログ・note・YouTube などの RSS/Atom。新着が自動で載る
  - https://note.com/xxxx/rss
links:                          # その他のリンク
  - label: GitHub
    url: https://github.com/xxxx

lab:
  name: ○○研究室
  url: https://example.com
  description: 研究室の一行紹介

officeHours:
  - day: 水                     # 月 火 水 木 金 土 日 随時
    start: "18:00"              # 時刻は "" で囲む
    end: "19:00"
    place: オンライン（Zoom）
    url: https://zoom.us/j/xxxx  # 任意
    note: 前日までにSlackで連絡ください
officeHoursNote: 上記以外もメールで相談ください

message: |                      # 相談しにきてほしい学生へのメッセージ（複数行OK）
  「AIで何か作ってみたい」と思ったら、それだけで十分です。
lookingFor:                     # こんな学生に来てほしい（短く）
  - 画像・動画生成AIで作品をつくりたい人

courses:                        # 担当科目。シラバスの「授業概要」「到達目標」から
  - name: クリエイティブAI
    term: 前期
    grade: 2年次
    required: false             # 必修なら true
    summary: 授業概要
    outcomes:
      - 何ができるようになるか

topics:                         # 最近のトピック（新しい順でなくてもOK。自動で並べます）
  - date: 2026-10-01
    title: 〇〇学会で発表しました
    url: https://example.com

highlights:                     # 年度の取り組み（評価シートから下書きを作れる。下記）
  - year: 2026
    category: 教育
    goal: 目標
    result: 実績

bio: |                          # 自由に書ける自己紹介（Markdown）
  ## 研究していること
  ...

photo: /photos/xxx.jpg          # 写真を差し替えたいとき（public/photos/ に置く）
specialty: [AI, デザイン]       # 専門分野の表示を変えたいとき
hidden: true                    # 一覧に出したくないとき
```

全項目の正確な定義は [`src/content.config.ts`](src/content.config.ts) にあります。書き間違いは PR の自動チェックで分かります。

## 自動で取り込まれる情報

| 情報 | 置き場所 | 更新 |
|---|---|---|
| 公式サイトの氏名・職位・経歴・メッセージ・写真 | `data/official/<ID>.yaml` | 毎日チェックし、変更があれば PR を作成 |
| researchmap の業績・RSS の新着 | `data/feeds/<ID>.yaml` | 毎日取得して自動公開 |

`data/` 以下は機械が書くファイルです。**手で編集しないでください**（次の取り込みで上書きされます）。
公式サイトと違う表記にしたいときは、`teachers/<ID>.yaml` 側で上書きします（`photo` / `specialty`）。

X（Twitter）は API が有料のため、投稿の自動取り込みはしていません（リンクのみ）。

## 評価シートから「年度の取り組み」の下書きを作る

教育職員評価基準シート（xlsx）の **本人コメント（目標・実績）と本人総括だけ** を取り出して下書きを作れます。
点数・教員平均・評価者コメントは読み込みません。

```bash
pnpm import-eval ~/Downloads/教育職員評価基準シート....xlsx shirai-akihiko
```

下書きは `.private/<ID>-eval.yaml`（Git に入らない場所）に出ます。載せたい部分だけを自分の YAML の `highlights:` にコピーしてください。
**評価シート本体は絶対にコミットしないでください**（`.gitignore` と CI で防いでいます）。

## 開発者向け

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # dist/ に静的サイトを出力（YAML の検証も兼ねる）
pnpm check      # 型チェック
pnpm scrape     # 公式サイトを取り込む
pnpm feeds      # researchmap・RSS を取り込む（pnpm feeds <ID> で 1 人だけ）
pnpm run deploy # Cloudflare Pages に公開（.secrets/kaishi.env が必要。通常は GitHub Actions が行う）
```

- 構成: Astro（静的サイト）→ Cloudflare Pages（本番 https://kaishi-lab.pages.dev 、PR ごとにプレビュー URL）
- GitHub Actions: `ci.yml`（PR チェック）/ `watch.yml`（毎日 03:00 JST に取り込み）/ `deploy.yml`（main への push で本番、PR ごとにプレビュー）
- デプロイには リポジトリの Secrets `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` が必要です
