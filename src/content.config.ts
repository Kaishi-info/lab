// データの定義。
// - teachers: 先生が編集する teachers/<slug>.yaml
// - official: 公式サイトから自動取得（data/official/<slug>.yaml）
// - feeds:    researchmap・RSS から自動取得（data/feeds/<slug>.yaml）
// ここに無い項目を書くとビルド（CI）でエラーになり、PR の段階で気づけます。
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const DAYS = ['月', '火', '水', '木', '金', '土', '日', '随時'] as const;
const time = z.string().regex(/^\d{1,2}:\d{2}$/, '"18:00" のように書いてください');
// YAML の日付（2026-10-01）は Date に、年だけ（2023）は数値になるので、文字列にそろえる
const date = z
  .union([z.string(), z.date(), z.number()])
  .transform((d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d)));

// ID はファイル名（shirai-akihiko.yaml → shirai-akihiko）
const yamlFiles = (base: string) =>
  glob({ pattern: '*.yaml', base, generateId: ({ entry }) => entry.replace(/\.yaml$/, '') });

const teachers = defineCollection({
  loader: yamlFiles('./teachers'),
  // 雛形のまま（全部コメント）のファイルは空として扱う
  schema: z.preprocess(
    (v) => v ?? {},
    z
    .object({
      // 外部サービス
      researchmap: z.string().optional(), // researchmap の permalink（https://researchmap.jp/<ここ>/）
      x: z.string().regex(/^[A-Za-z0-9_]+$/, '@ なしの ID を書いてください').optional(),
      website: z.url().optional(), // 研究室サイト・CVサイト
      feeds: z.array(z.url()).optional(), // RSS / Atom
      links: z.array(z.object({ label: z.string(), url: z.url() })).optional(), // その他のリンク

      // 表示の上書き（公式サイトの情報を変えたいとき）
      photo: z.string().optional(), // 画像URL または public/ に置いたファイル（/photos/xxx.jpg）
      specialty: z.array(z.string()).optional(),

      // 研究室
      lab: z
        .object({
          name: z.string(),
          url: z.url().optional(),
          description: z.string().optional(),
        })
        .optional(),

      // オフィスアワー
      officeHours: z
        .array(
          z.object({
            day: z.enum(DAYS),
            start: time.optional(),
            end: time.optional(),
            place: z.string().optional(),
            url: z.url().optional(),
            note: z.string().optional(),
          }),
        )
        .optional(),
      officeHoursNote: z.string().optional(),

      // 学生へ
      message: z.string().optional(), // 相談しにきてほしい学生へのメッセージ
      lookingFor: z.array(z.string()).optional(), // こんな学生に来てほしい（短く）

      // 担当科目（シラバスの「何が学べるか」）
      courses: z
        .array(
          z.object({
            name: z.string(),
            term: z.string().optional(), // 前期 / 後期 など
            grade: z.string().optional(), // 配当年次
            required: z.boolean().optional(), // 必修なら true
            summary: z.string().optional(), // 授業概要
            outcomes: z.array(z.string()).optional(), // 到達目標（何ができるようになるか）
            url: z.url().optional(),
          }),
        )
        .optional(),

      // 最近のトピック（自分で書く）
      topics: z
        .array(
          z.object({
            date,
            title: z.string(),
            url: z.url().optional(),
            body: z.string().optional(),
          }),
        )
        .optional(),

      // 年度の取り組み（評価シートの本人コメントから pnpm import-eval で下書きを作れる）
      highlights: z
        .array(
          z.object({
            year: z.number().int(),
            category: z.string(),
            goal: z.string().optional(),
            result: z.string().optional(),
          }),
        )
        .optional(),

      bio: z.string().optional(), // 自由に書ける自己紹介・研究室紹介（Markdown）
      hidden: z.boolean().optional(), // true にすると一覧に出さない
    })
    .strict(),
  ),
});

const official = defineCollection({
  loader: yamlFiles('./data/official'),
  schema: z.object({
    slug: z.string(),
    sourceUrl: z.url(),
    order: z.number(),
    name: z.string(),
    nameEn: z.string(),
    title: z.string(),
    position: z.string(),
    degrees: z.array(z.string()),
    specialty: z.array(z.string()),
    photo: z.string(),
    messages: z.array(z.object({ audience: z.string(), heading: z.string(), body: z.string() })),
    sections: z.array(z.object({ label: z.string(), lines: z.array(z.string()) })),
  }),
});

const feeds = defineCollection({
  loader: yamlFiles('./data/feeds'),
  schema: z.object({
    items: z.array(
      z.object({
        source: z.string(),
        kind: z.string(),
        title: z.string(),
        date,
        url: z.string().optional(),
        venue: z.string().optional(),
      }),
    ),
  }),
});

export const collections = { teachers, official, feeds };
export { DAYS };
