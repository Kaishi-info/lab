# CLAUDE.md

@AGENTS.md

ルールの正本は AGENTS.md です。ここには Claude Code 固有の補足だけを書きます。

- 先生のページ編集を頼まれたら、まず `teachers/<ID>.yaml` を読み、`pnpm build` で検証してから PR を作る
- 見た目を変えたら `pnpm dev` で 375px 幅と PC 幅の両方を確認する
- `gh pr merge` は実行しない（マージは人間）
