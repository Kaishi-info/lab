// @ts-check
import { defineConfig } from 'astro/config';

// Cloudflare Pages で公開する（本番は lab.kaishi.ac.jp の予定）。
// サブパスで公開する場合（GitHub Pages など）は SITE / BASE_PATH を渡す。サイト内リンクは src/lib/teachers.ts の href() を通す
export default defineConfig({
  site: process.env.SITE ?? 'https://lab.kaishi.ac.jp',
  base: process.env.BASE_PATH ?? '/',
  trailingSlash: 'always',
});
