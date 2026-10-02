// データの定義。
// - teachers: 先生が編集する teachers/<slug>.yaml
// - official: 公式サイトから自動取得（data/official/<slug>.yaml）
// - feeds:    researchmap・RSS から自動取得（data/feeds/<slug>.yaml）
// ここに無い項目を書くとビルド（CI）でエラーになり、PR の段階で気づけます。
import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { AUDIENCE_IDS, CLUSTER_IDS, EVIDENCE_KINDS, JOIN_TYPES } from './lib/taxonomy';

const DAYS = ['月', '火', '水', '木', '金', '土', '日', '随時'] as const;
const time = z.string().regex(/^\d{1,2}:\d{2}$/, '"18:00" のように書いてください');
// YAML の日付（2026-10-01）は Date に、年だけ（2023）は数値になるので、文字列にそろえる
const date = z
  .union([z.string(), z.date(), z.number()])
  .transform((d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d)));

// ID はファイル名（shirai-akihiko.yaml → shirai-akihiko）
const yamlFiles = (base: string) =>
  glob({ pattern: '*.yaml', base, generateId: ({ entry }) => entry.replace(/\.yaml$/, '') });

const link = z.object({ label: z.string(), url: z.url() });
// 証拠となる資料（動画・スライド・コードなど）。Strategy 3
const evidence = z.object({
  kind: z.enum(EVIDENCE_KINDS),
  title: z.string().optional(),
  url: z.url(),
});

const teachers = defineCollection({
  loader: yamlFiles('./teachers'),
  // 雛形のまま（全部コメント）のファイルは空として扱う
  schema: z.preprocess(
    (v) => v ?? {},
    z
      .object({
        // ── 1. Hero ─────────────────────────────
        catchcopy: z.string().max(60).optional(), // 「○○を使って、○○をできるようにする」
        clusters: z.array(z.enum(CLUSTER_IDS)).max(3).optional(), // 学部の領域（src/lib/taxonomy.ts）
        specialty: z.array(z.string()).optional(), // 専門分野（公式サイトの表記を上書き）
        photo: z.string().optional(), // 画像URL または public/ に置いたファイル（/photos/xxx.jpg）

        // ── 2. What you can learn ───────────────
        learn: z.array(z.string()).max(5).optional(), // この先生から学べること（3〜5項目）

        // ── 3. Courses ──────────────────────────
        courses: z
          .array(
            z.object({
              name: z.string(),
              term: z.string().optional(), // 前期 / 後期
              grade: z.string().optional(), // 配当年次
              required: z.boolean().optional(), // 必修なら true
              summary: z.string().optional(), // 学ぶこと（シラバスの授業概要）
              make: z.array(z.string()).optional(), // 作るもの
              outcomes: z.array(z.string()).optional(), // 到達目標
              assignments: z.array(z.string()).optional(), // 課題・演習の例
              evidence: z.array(evidence).optional(), // 授業動画・スライド・課題サンプルなど
              url: z.url().optional(),
            }),
          )
          .optional(),

        // ── 4. Projects（研究・制作・社会実装）───
        projects: z
          .array(
            z.object({
              title: z.string(),
              kind: z.enum(['研究', '制作', '社会実装', 'PBL', '展示', 'イベント']).optional(),
              year: z.number().int().optional(),
              description: z.string().optional(),
              partners: z.array(z.string()).optional(), // 連携先（企業・自治体・高校など）
              url: z.url().optional(),
              evidence: z.array(evidence).optional(),
            }),
          )
          .optional(),

        // ── 5. Student Works ────────────────────
        // 学生の氏名を載せるのは本人の同意がある場合だけ
        works: z
          .array(
            z.object({
              title: z.string(),
              by: z.string().optional(), // 制作者（同意がある場合のみ。例: 2年 Aさん）
              course: z.string().optional(), // どの授業で作ったか
              year: z.number().int().optional(),
              description: z.string().optional(),
              image: z.string().optional(),
              url: z.url().optional(),
              comment: z.string().optional(), // 学生コメント
            }),
          )
          .optional(),

        // ── 6. Research ─────────────────────────
        researchThemes: z.array(z.string()).optional(), // 研究テーマ
        researchmap: z.string().optional(), // researchmap の permalink → 業績を自動取得
        feeds: z.array(z.url()).optional(), // ブログ・note・YouTube などの RSS / Atom → 新着を自動取得

        // ── 7. For Students ─────────────────────
        message: z.string().optional(), // こんな人と一緒に学びたい（メッセージ）
        lookingFor: z.array(z.string()).optional(), // こんな人に来てほしい（短く）
        consult: z.array(z.string()).optional(), // 相談テーマ（こんな相談に乗れます）
        audiences: z.partialRecord(z.enum(AUDIENCE_IDS), z.string()).optional(), // 立場別のひとこと
        careers: z.array(z.string()).optional(), // この学びがつながる進路・キャリア

        // ── 8. Contact / Join ───────────────────
        join: z
          .array(
            z.object({
              type: z.enum(JOIN_TYPES),
              description: z.string().optional(),
              url: z.url().optional(),
            }),
          )
          .optional(),
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

        // ── 研究室・リンク ──────────────────────
        lab: z
          .object({
            name: z.string(),
            url: z.url().optional(),
            description: z.string().optional(),
          })
          .optional(),
        website: z.url().optional(), // 研究室サイト・CVサイト
        portfolio: z.url().optional(), // ポートフォリオ
        github: z.string().regex(/^[A-Za-z0-9-]+$/, 'GitHub のユーザー名だけを書いてください').optional(),
        bluesky: z.string().regex(/^[A-Za-z0-9.-]+$/, '@ なしのハンドル（例: name.bsky.social）を書いてください').optional(),
        instagram: z.string().regex(/^[A-Za-z0-9._]+$/, '@ なしの ID を書いてください').optional(),
        note: z.string().regex(/^[A-Za-z0-9_]+$/, 'note の ID（note.com/<ここ>）を書いてください').optional(),
        youtube: z.url().optional(), // チャンネルの URL
        linkedin: z.url().optional(),
        x: z.string().regex(/^[A-Za-z0-9_]+$/, '@ なしの ID を書いてください').optional(),
        links: z.array(link).optional(),

        // ── 最近の活動・記録 ────────────────────
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

        bio: z.string().optional(), // 自由に書ける自己紹介（Markdown）
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

// 科目一覧（pnpm import-curriculum で CSV から生成）
const curriculum = defineCollection({
  loader: file('./data/curriculum.yaml'),
  schema: z.object({
    name: z.string(),
    category: z.string(),
    area: z.string(),
    form: z.string(),
    grade: z.string(),
    term: z.string(),
    credits: z.number().optional(),
    required: z.boolean(),
    dp: z.array(z.string()),
    summary: z.string(),
    // 科目一覧から読み取ったオフィスアワーの枠（start / end は 0:00 からの分）
    officeHours: z
      .array(z.object({ teacher: z.string().optional(), day: z.enum(['月', '火', '水', '木', '金', '土', '日']), start: z.number(), end: z.number() }))
      .optional(),
    teachers: z.array(z.object({ name: z.string(), slug: z.string().optional() })),
  }),
});

export const collections = { teachers, official, feeds, curriculum };
export { DAYS };
