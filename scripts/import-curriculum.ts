// 科目一覧（オフィスアワー一覧(科目一覧).csv）から data/curriculum.yaml を作る。
// - CSV 本体はコミットしない（.gitignore 済み）。生成した YAML だけをコミットする
// - 担当教員の氏名は data/official/ の先生と照合し、一致すれば slug を付ける
// - オフィスアワーは原文を保存しない（内部メモが混ざることがあるため）。読み取れた曜日・時刻だけを保存する
//
// 使い方: pnpm import-curriculum ~/Downloads/オフィスアワー一覧(科目一覧).csv
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { parse as parseYaml, stringify } from 'yaml';
import { parseByTeacher } from '../src/lib/officeHours.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const normName = (s: string) => s.replace(/[\s　]/g, '');
const clean = (s: string) => s.replace(/　/g, ' ').replace(/[ \t]+/g, ' ').trim();

// 「正畑：…、西田：…」と書き分けがあれば先生ごと、無ければ筆頭の担当教員の枠とする
function officeHoursOf(text: string, teachers: { name: string; slug?: string }[]) {
  const family = (n: string) => n.split(' ')[0];
  const byName = parseByTeacher(text, teachers.map((t) => family(t.name)));
  return [...byName.entries()].flatMap(([who, slots]) => {
    const t = who ? teachers.find((x) => family(x.name) === who) : teachers[0];
    return slots.map((s) => ({ teacher: t?.name, day: s.day, start: s.start, end: s.end }));
  });
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('使い方: pnpm import-curriculum <科目一覧.csv>');
    process.exit(1);
  }
  const rows: string[][] = parse(await readFile(file, 'utf8'), { bom: true, relax_column_count: true });

  // 見出し行（「授業科目の名称」を含む行）から列の位置を決める
  const hi = rows.findIndex((r) => r.includes('授業科目の名称'));
  const h = rows[hi];
  const col = (name: string) => h.findIndex((c) => c.startsWith(name));
  const C = {
    code: col('科目コード'),
    category: col('分類'),
    area: h.indexOf('科目'),
    name: col('授業科目の名称'),
    form: col('授業形態'),
    grade: col('配当年次'),
    term: col('配当学期'),
    summary: col('科目概要'),
    credits: col('単位'),
    required: col('必修・選択'),
    ohOrig: col('オフィスアワー（'),
    ohFix: col('オフィスアワー修正'),
    teachers: col('担当教員'),
  };
  const dpCols = ['A', 'B', 'C', 'D'].map((k) => [k, h.indexOf(k)] as const);

  // サイトに載っている先生（基幹教員）の氏名 → slug
  const officialDir = join(ROOT, 'data/official');
  const slugByName = new Map<string, string>();
  for (const f of await readdir(officialDir)) {
    const o = parseYaml(await readFile(join(officialDir, f), 'utf8'));
    slugByName.set(normName(o.name), o.slug);
  }

  const courses = rows
    .slice(hi + 1)
    .filter((r) => /^\d+$/.test(r[0]?.trim() ?? '') && r[C.name]?.trim())
    .map((r) => {
      const ohText = [r[C.ohFix], r[C.ohOrig]].map((s) => clean(s ?? '')).find((s) => s && s !== '未定' && s !== '#N/A');
      const teachers = r
        .slice(C.teachers)
        .map(clean)
        .filter(Boolean)
        .map((name) => {
          const slug = slugByName.get(normName(name));
          return slug ? { name, slug } : { name };
        });
      return {
        id: clean(r[C.code]),
        name: clean(r[C.name]),
        category: clean(r[C.category]),
        area: clean(r[C.area]),
        form: clean(r[C.form]),
        grade: clean(r[C.grade]),
        term: clean(r[C.term]),
        credits: Number(r[C.credits]) || undefined,
        required: r[C.required]?.includes('必修') ?? false,
        dp: dpCols.filter(([, i]) => r[i]?.trim()).map(([k]) => k),
        summary: (r[C.summary] ?? '').trim(),
        ...(ohText && { officeHours: officeHoursOf(ohText, teachers) }),
        teachers,
      };
    });

  const out = join(ROOT, 'data/curriculum.yaml');
  await writeFile(
    out,
    `# 自動生成（pnpm import-curriculum）。手で編集しないでください\n` + stringify(courses, { lineWidth: 0 }),
  );
  const linked = new Set(courses.flatMap((c) => c.teachers.flatMap((t) => ('slug' in t ? [t.slug] : []))));
  console.log(`${courses.length}科目を書き出しました: ${out}`);
  console.log(`サイトの先生と対応: ${linked.size}名 / 未対応の先生: ${[...slugByName.values()].filter((s) => !linked.has(s)).join(', ') || 'なし'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
