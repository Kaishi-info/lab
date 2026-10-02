// 教育職員評価基準シート（xlsx）から、ページに載せられそうな文章だけを取り出して下書きを作る。
//
// ⚠ 評価シートそのもの・点数・教員平均・評価者コメントは公開リポジトリに絶対に入れない。
//   このスクリプトは「本人コメント（目標・実績）」「本人総括」「researchmap URL」だけを読み、
//   .private/<slug>-eval.yaml（git 管理外）に下書きを書き出す。
//   内容を確認し、載せたい部分だけを teachers/<slug>.md の `highlights:` に自分でコピーしてください。
//
// 使い方: pnpm import-eval ~/Downloads/教育職員評価基準シート....xlsx shirai-akihiko [年度]
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { stringify } from 'yaml';

const ROOT = new URL('..', import.meta.url).pathname;

type Highlight = { year: number; category: string; goal?: string; result?: string };

const cellText = (v: ExcelJS.CellValue): string => {
  if (v == null) return '';
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('text' in v) return String(v.text);
    if ('result' in v) return String(v.result ?? '');
    if (v instanceof Date) return v.toISOString();
  }
  return String(v);
};

// 4月始まりの年度
function currentAcademicYear(now = new Date()) {
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

async function main() {
  const [file, slug, yearArg] = process.argv.slice(2);
  if (!file || !slug) {
    console.error('使い方: pnpm import-eval <評価シート.xlsx> <slug> [年度]');
    process.exit(1);
  }
  const year = yearArg ? Number(yearArg) : currentAcademicYear();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  const highlights: Highlight[] = [];
  let summary = '';
  let researchmap = '';

  for (const ws of wb.worksheets) {
    // 見出し行から「目標（春）」「実績（秋）」の列を探す
    let goalCol = 0;
    let resultCol = 0;
    ws.eachRow((row) => {
      row.eachCell((cell, col) => {
        const t = cellText(cell.value);
        if (t.includes('目標設定に関する本人コメント')) goalCol = col;
        if (t.includes('実績に関する本人コメント')) resultCol = col;
        if (t.includes('リサーチマップURL')) {
          const v = cellText(row.getCell(col + 1).value);
          if (/^https?:\/\/researchmap\.jp\//.test(v)) researchmap = v;
        }
      });
    });
    if (!goalCol && !resultCol) continue;

    ws.eachRow((row) => {
      const label = cellText(row.getCell(2).value).trim(); // B列: ①PM実践経験 など
      // 結合セルは範囲内の全行で同じ値が返るので、カテゴリごとに最初の1行だけ使う
      if (/^[①-⑳]/.test(label) && !highlights.some((h) => h.category === label.replace(/^[①-⑳]/, '').trim())) {
        const goal = goalCol ? cellText(row.getCell(goalCol).value).trim() : '';
        const result = resultCol ? cellText(row.getCell(resultCol).value).trim() : '';
        if (goal || result) {
          highlights.push({
            year,
            category: label.replace(/^[①-⑳]/, '').trim(),
            ...(goal && { goal }),
            ...(result && { result }),
          });
        }
      }
      if (label.startsWith('本人総括')) {
        // 本人総括の本文は見出しの1行下（結合セル）にある
        ws.getRow(row.number + 1).eachCell((cell, col) => {
          const t = cellText(cell.value).trim();
          if (col > 2 && t && !t.startsWith('本人総括')) summary ||= t;
        });
      }
    });
    if (highlights.length) break; // 記入済みのシートを1枚だけ使う
  }

  const outDir = join(ROOT, '.private');
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `${slug}-eval.yaml`);
  const body = [
    '# 評価シートからの下書き（git 管理外）。点数は含みません。',
    '# 載せたい項目だけを teachers/' + slug + '.md の frontmatter にコピーしてください。',
    '# 学生向けに言い換えると読みやすくなります（AI に「学生向けに書き直して」と頼むのがおすすめ）。',
    '',
    stringify({
      ...(researchmap && { researchmap: researchmap.replace(/^https?:\/\/researchmap\.jp\//, '').replace(/\/.*$/, '') }),
      highlights,
      ...(summary && { summaryDraft: summary }),
    }),
  ].join('\n');
  await writeFile(outPath, body);
  console.log(`下書きを書き出しました: ${outPath}`);
  console.log(`  項目: ${highlights.length}件${researchmap ? ` / researchmap: ${researchmap}` : ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
