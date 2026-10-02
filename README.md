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

自分の YAML ファイルに、使い方のコメント付きで全項目が並んでいます。ページは「この先生と何を学び、何を作れるか」が伝わる順に表示されます。

| # | 項目 | 内容 |
|---|---|---|
| 1 | `catchcopy` / `clusters` | 「○○を使って、○○をできるようにする」形のひとこと／学部の領域 |
| 2 | `learn` | この先生から学べること（3〜5項目） |
| 3 | `courses` | 担当科目に「作るもの・到達目標・課題・授業動画やスライド」を書き足す（科目と概要は科目一覧から自動） |
| 4 | `projects` | 研究・制作・社会実装・PBL |
| 5 | `works` | 学生の作品・成果（氏名は本人の同意がある場合だけ） |
| 6 | `researchThemes` / `researchmap` / `feeds` | 研究テーマ／論文・発表の自動取得／ブログ等の自動取得 |
| 7 | `message` / `lookingFor` / `consult` / `careers` / `audiences` | 学生へのメッセージ、相談テーマ、進路、立場別のひとこと |
| 8 | `join` / `officeHours` | 参加・相談の入口、オフィスアワー（書けば科目一覧の時間より優先） |
| - | `x` / `github` / `portfolio` / `website` / `lab` / `links` | リンク |
| - | `topics` / `bio` / `highlights` | 最近のトピック、自己紹介（Markdown）、年度の取り組み |

まだ全員が書いた項目がそろっていない段階でも、空の項目はページに表示されません。整備状況は `/status/` で確認できます。

全項目の正確な定義は [`src/content.config.ts`](src/content.config.ts) にあります。書き間違いは PR の自動チェックで分かります。

## 自動で取り込まれる情報

| 情報 | 置き場所 | 更新 |
|---|---|---|
| 公式サイトの氏名・職位・経歴・メッセージ・写真 | `data/official/<ID>.yaml` | 毎日チェックし、変更があれば PR を作成 |
| 科目一覧（科目概要・担当・オフィスアワー） | `data/curriculum.yaml` | CSV が更新されたら `pnpm import-curriculum` |
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
pnpm import-curriculum <科目一覧.csv>  # 科目一覧（オフィスアワー含む）を取り込む
pnpm preview:cloudflare  # 手元から Cloudflare Pages にプレビュー（~/.secrets/kaishi.env が必要）
```

- 構成: Astro（静的サイト）→ GitHub Pages（GitHub Actions でビルド・公開。独自ドメイン設定前は https://kaishi-info.github.io/lab/ ）
- GitHub Actions: `ci.yml`（PR チェック）/ `watch.yml`（毎日 03:00 JST に取り込み）/ `deploy.yml`（main への push で GitHub Pages に公開）
- サイト内リンクは `href()`（src/lib/teachers.ts）を通す。GitHub Pages のサブパスでも動くように
