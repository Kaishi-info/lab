// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages で公開する。独自ドメイン（lab.kaishi.ac.jp）の設定前は
// https://kaishi-info.github.io/lab/ のようにサブパスになるので、Actions から SITE / BASE_PATH を渡す
export default defineConfig({
  site: process.env.SITE ?? 'https://lab.kaishi.ac.jp',
  base: process.env.BASE_PATH ?? '/',
  trailingSlash: 'always',
});
