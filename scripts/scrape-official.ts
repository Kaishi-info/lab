// 公式サイト（教員紹介）をスクレイピングして data/official/<slug>.yaml を更新する。
// - data/official/ は機械管理。手で編集しない（次回実行で上書きされる）。
// - teachers/<slug>.yaml は先生が編集するファイル。存在しない場合だけ雛形を作り、既存ファイルは絶対に上書きしない。
//
// 使い方: pnpm scrape
import { mkdir, readFile, writeFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { stringify } from 'yaml';

const LIST_URL = 'https://kaishi.ac.jp/info-d/teacher/';
const UA = 'kaishi-lab-bot/1.0 (+https://github.com/Kaishi-info/lab)';
const ROOT = new URL('..', import.meta.url).pathname;
const OFFICIAL_DIR = join(ROOT, 'data/official');
const TEACHERS_DIR = join(ROOT, 'teachers');

type Section = { label: string; lines: string[] };
type Official = {
  slug: string;
  sourceUrl: string;
  order: number;
  name: string;
  nameEn: string;
  title: string; // 例: 教授
  position: string; // 例: 情報デザイン学部 教授
  degrees: string[];
  specialty: string[];
  photo: string;
  messages: { audience: string; heading: string; body: string }[];
  sections: Section[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clean = (s: string) => s.replace(/[\s　]+/g, ' ').trim();

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

// <br> や .line / .career-row を改行として扱い、行の配列にする
function ddLines($: cheerio.CheerioAPI, dd: cheerio.Cheerio<any>): string[] {
  const rows = dd.find('.career-row');
  if (rows.length) {
    return rows
      .toArray()
      .map((r) => {
        const period = clean($(r).find('.career-period').text());
        const place = clean($(r).find('.career-place').text());
        return period ? `${period}｜${place}` : place;
      })
      .filter(Boolean);
  }
  const html = (dd.html() ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/span>\s*<span class="line">/gi, '\n');
  return cheerio
    .load(`<div>${html}</div>`)('div')
    .text()
    .split('\n')
    .map((l) => clean(l).replace(/^・/, ''))
    .filter(Boolean);
}

// 一覧ページのカード（学部長などカード以外の枠で載る先生はここに含まれない）
function parseCards(html: string) {
  const $ = cheerio.load(html);
  return $('.p-teacher-card__item')
    .toArray()
    .map((el) => {
      const card = $(el);
      const href = card.find('.p-teacher-card__profile a').first().attr('href') ?? '';
      const slug = href.match(/\/teacher\/([^/]+)\/?$/)?.[1];
      if (!slug) return null;
      // 例: ［准教授］博士(知識科学)<br>修士(技術経営)
      const positionLines = (card.find('.position').html() ?? '')
        .split(/<br\s*\/?>/i)
        .map((l) => clean(cheerio.load(`<i>${l}</i>`)('i').text()))
        .filter(Boolean);
      const title = positionLines[0]?.match(/［(.+?)］/)?.[1] ?? '';
      const degrees = positionLines.map((l) => l.replace(/^［.+?］/, '').trim()).filter(Boolean);
      const messages: Official['messages'] = [];
      card.find('.p-teacher-card__comment .is-ttl').each((_, t) => {
        const ttl = $(t);
        messages.push({
          audience: clean(ttl.find('span').first().text()),
          heading: clean(ttl.find('p').first().text()),
          body: clean(ttl.next('p').text()),
        });
      });
      return {
        slug,
        title,
        degrees,
        specialty: clean(card.find('.p-teacher-card__text').text())
          .split(/\s*[\/／]\s*/)
          .filter(Boolean),
        listPhoto: card.find('.p-teacher-card__img img').attr('src') ?? '',
        messages,
      };
    })
    .filter((x) => x !== null);
}

// 一覧ページに出てくるプロフィールリンクを登場順に（これを教員の正とする）
function parseSlugs(html: string): string[] {
  const slugs = [...html.matchAll(/https:\/\/kaishi\.ac\.jp\/info-d\/teacher\/([a-z0-9-]+)\/"/g)].map((m) => m[1]);
  return [...new Set(slugs)];
}

function parseDetail(html: string) {
  const $ = cheerio.load(html);
  const sections: Section[] = $('.p-teacher-detail__row')
    .toArray()
    .map((row) => ({
      label: clean($(row).find('dt').text()),
      lines: ddLines($, $(row).find('dd')),
    }))
    .filter((s) => s.label && s.label !== '氏名' && s.lines.length);
  return {
    name: clean($('.p-teacher-detail__name').text()),
    nameEn: clean($('.p-teacher-detail__en').text()),
    position: clean($('.p-teacher-detail__position').text()),
    photo: $('.p-teacher-detail__photo img').attr('src') ?? '',
    sections,
  };
}

function stub(o: Official): string {
  return `# ${o.name} 先生のページ
# 公式サイトの情報（氏名・職歴など）と担当科目（科目一覧）は自動で入ります。ここには書かなくてOK。
# 書きたい項目の先頭の「# 」を消して使ってください。書き方: README.md / 全項目の定義: src/content.config.ts
# ページは「この先生と何を学び、何を作れるか」が伝わる順に並びます。

# ── 1. ひとこと ────────────────
# catchcopy: ○○を使って、○○をできるようにする   # 60字まで
# clusters: [generative-ai, hci]   # 学部の領域（src/lib/taxonomy.ts の ID。3つまで）

# ── 2. この先生から学べること（3〜5項目）──
# learn:
#   - 生成AIで画像・動画をつくる技術
#   - 作品を公開して評価を受ける方法

# ── 3. 授業（科目一覧の授業に書き足せます。name は科目名と同じに）──
# courses:
#   - name: クリエイティブAI
#     make: [AI画像作品, ポートフォリオ]        # 作るもの
#     outcomes: [AIで作品をつくる技術を説明できる] # 到達目標
#     assignments: [毎週の制作課題]              # 課題・演習
#     evidence:                                  # 授業動画・スライド・課題例など
#       - kind: スライド
#         title: 第1回
#         url: https://example.com

# ── 4. プロジェクト（研究・制作・社会実装）──
# projects:
#   - title: プロジェクト名
#     kind: 社会実装      # 研究 / 制作 / 社会実装 / PBL / 展示 / イベント
#     year: 2026
#     description: 一行説明
#     partners: [○○市, ○○株式会社]
#     url: https://example.com

# ── 5. 学生の作品・成果（氏名は本人の同意がある場合だけ）──
# works:
#   - title: 作品名
#     by: 2年 Aさん
#     course: クリエイティブAI
#     url: https://example.com

# ── 6. 研究 ───────────────────
# researchThemes: [研究テーマ1, 研究テーマ2]
# researchmap: your-permalink      # https://researchmap.jp/<ここ>/ → 論文・発表を自動で取得
# feeds: [https://note.com/xxxx/rss] # ブログ・note・YouTube の RSS → 新着を自動で取得

# ── 7. 学生へ ─────────────────
# message: |
#   こんな人と一緒に学びたい
# lookingFor: [こんな人に来てほしい（短く）]
# consult: [こんな相談に乗れます]
# careers: [この学びがつながる進路]
# audiences:                        # 立場別のひとこと
#   high-school: 高校生へ
#   adult: 社会人へ

# ── 8. 参加・相談の入口 ────────
# join:
#   - type: ゼミ        # 授業 / ゼミ / 研究 / プロジェクト / 高大連携 / 共同研究 / 取材・講演
#     description: 説明
# officeHours:                      # 書くと科目一覧の時間より優先されます
#   - day: 水                       # 月〜日 / 随時
#     start: "18:00"
#     end: "19:00"
#     place: オンライン（Zoom）

# ── リンク ───────────────────
# x: your_handle                    # X の ID（@なし）
# github: your-name                 # GitHub のユーザー名
# bluesky: name.bsky.social         # Bluesky のハンドル
# instagram: your_id
# note: your_id                     # note.com/<ここ>
# youtube: https://www.youtube.com/@xxxx
# linkedin: https://www.linkedin.com/in/xxxx
# portfolio: https://example.com
# website: https://example.com     # 研究室サイト・CVサイト
# lab:
#   name: ○○研究室
#   url: https://example.com

# ── 最近のトピック・自己紹介 ────
# topics:
#   - date: 2026-10-01
#     title: 最近のトピック
#     url: https://example.com
# bio: |
#   自由に書ける自己紹介（Markdown）
`;
}

// README の先生一覧（自分のファイルへのリンク）を書き換える
const SITE = 'https://kaishi-lab.pages.dev';
async function updateReadme(rows: Official[]) {
  const path = join(ROOT, 'README.md');
  const src = await readFile(path, 'utf8');
  const start = src.indexOf('<!-- teachers:start');
  const end = src.indexOf('<!-- teachers:end -->');
  if (start < 0 || end < 0) return;
  const head = src.slice(start, src.indexOf('-->', start) + 3);
  const table = [
    '| 先生 | 自分のファイル（押すと編集画面） | 公開ページ |',
    '|---|---|---|',
    ...rows.map(
      (o) =>
        `| ${o.name} | [teachers/${o.slug}.yaml](https://github.com/Kaishi-info/lab/edit/main/teachers/${o.slug}.yaml) | [ページ](${SITE}/${o.slug}/) |`,
    ),
  ].join('\n');
  await writeFile(path, `${src.slice(0, start)}${head}\n${table}\n${src.slice(end)}`);
}

const exists = (p: string) => access(p).then(() => true, () => false);

async function main() {
  await mkdir(OFFICIAL_DIR, { recursive: true });
  await mkdir(TEACHERS_DIR, { recursive: true });

  const listHtml = await fetchHtml(LIST_URL);
  const slugs = parseSlugs(listHtml);
  const cards = new Map(parseCards(listHtml).map((c) => [c.slug, c]));
  if (slugs.length === 0) throw new Error('教員一覧が0件。公式サイトの構造が変わった可能性があります');
  console.log(`一覧: ${slugs.length}名（うちカード形式 ${cards.size}名）`);

  const seen = new Set<string>();
  const all: Official[] = [];
  const changed: string[] = [];
  const created: string[] = [];

  for (const [order, slug] of slugs.entries()) {
    await sleep(500); // 公式サイトに負荷をかけない
    const sourceUrl = `${LIST_URL}${slug}/`;
    const detail = parseDetail(await fetchHtml(sourceUrl));
    const card = cards.get(slug);
    const official: Official = {
      slug,
      sourceUrl,
      order,
      name: detail.name,
      nameEn: detail.nameEn,
      title: card?.title || detail.position.split(' ').pop() || '',
      position: detail.position,
      degrees: card?.degrees ?? [],
      specialty: card?.specialty ?? [],
      photo: detail.photo || card?.listPhoto || '',
      messages: card?.messages ?? [],
      sections: detail.sections,
    };
    seen.add(slug);
    all.push(official);

    const yamlPath = join(OFFICIAL_DIR, `${slug}.yaml`);
    const next = '# 自動生成（pnpm scrape）。手で編集しないでください\n' + stringify(official, { lineWidth: 0 });
    const prev = await readFile(yamlPath, 'utf8').catch(() => '');
    if (prev !== next) {
      await writeFile(yamlPath, next);
      changed.push(slug);
    }

    const teacherPath = join(TEACHERS_DIR, `${slug}.yaml`);
    if (!(await exists(teacherPath))) {
      await writeFile(teacherPath, stub(official));
      created.push(slug);
    }
    console.log(`  ${prev === next ? '　' : '更新'} ${slug} ${official.name}`);
  }

  const removed = (await readdir(OFFICIAL_DIR))
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => f.replace(/\.yaml$/, ''))
    .filter((s) => !seen.has(s));

  await updateReadme(all);
  console.log(`\n更新: ${changed.length}件 / 新規ページ雛形: ${created.length}件`);
  if (removed.length) {
    // 自動削除はしない。人が確認してから消す
    console.log(`公式一覧から消えた教員（要確認・自動削除しません）: ${removed.join(', ')}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
