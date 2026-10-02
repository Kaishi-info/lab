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
const UA = 'kaishi-teachers-bot/1.0 (+https://github.com/Kaishi-info/teachers)';
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
# 公式サイト由来の情報（氏名・職歴など）は data/official/${o.slug}.yaml に自動で入ります。ここには書かなくてOK。
# 書きたい項目の先頭の「# 」を消して使ってください。書き方: README.md / 全項目の定義: src/content.config.ts

# researchmap: your-permalink      # https://researchmap.jp/<ここ>/ の部分。業績が自動で「最近の活動」に載ります
# x: your_handle                   # X(Twitter) のID（@なし）
# website: https://example.com     # 研究室サイト・CVサイトなど
# feeds:                           # ブログ・note などの RSS/Atom URL。新着が自動で載ります
#   - https://note.com/xxxx/rss

# lab:
#   name: ○○研究室
#   description: 研究室の一行紹介

# officeHours:
#   - day: 水                       # 月〜日 / 随時
#     start: "18:00"
#     end: "19:00"
#     place: オンライン（Zoom）
#     note: 前日までにSlackで連絡ください

# message: |
#   相談しにきてほしい学生へのメッセージ
# lookingFor:
#   - こんな学生に来てほしい、を短く

# courses:                         # 担当科目（シラバスの「授業概要」「到達目標」から）
#   - name: 科目名
#     term: 前期
#     grade: 2年次
#     summary: 授業概要
#     outcomes:
#       - 何ができるようになるか

# topics:
#   - date: 2026-10-01
#     title: 最近のトピック
#     url: https://example.com

# bio: |
#   自由に書ける自己紹介・研究室紹介（Markdown が使えます）
`;
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
