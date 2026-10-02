// 先生ごとの外部ソースから「最近の活動」を集めて data/feeds/<slug>.yaml に保存する。
// - researchmap: teachers/<slug>.yaml の `researchmap:` に書いた permalink から公開業績を取得（API: https://api.researchmap.jp/）
// - feeds: `feeds:` に書いた RSS / Atom（CVサイト・ブログ・note・YouTube など）
// - X は API が有料のため取得しない（ページではリンクのみ表示）
//
// 取得に失敗したソースは前回の結果を残す（一時的な障害でページから活動が消えないように）。
//
// 使い方: pnpm feeds            # 全員
//         pnpm feeds shirai-akihiko
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml, stringify } from 'yaml';
import { XMLParser } from 'fast-xml-parser';

const ROOT = new URL('..', import.meta.url).pathname;
const TEACHERS_DIR = join(ROOT, 'teachers');
const FEEDS_DIR = join(ROOT, 'data/feeds');
const UA = 'kaishi-teachers-bot/1.0 (+https://github.com/Kaishi-info/teachers)';
const MAX_PER_SOURCE = 30;

export type FeedItem = {
  source: string; // 'researchmap' または フィードURL
  kind: string; // 表示用ラベル（論文・発表・ブログ など）
  title: string;
  date: string; // YYYY / YYYY-MM / YYYY-MM-DD
  url?: string;
  venue?: string;
};
type FeedFile = { items: FeedItem[] };

// researchmap の業績種別 → [表示ラベル, タイトルのキー, 掲載先のキー]
const RM_TYPES: Record<string, [string, string, string?]> = {
  published_papers: ['論文', 'paper_title', 'publication_name'],
  misc: ['記事・解説', 'paper_title', 'publication_name'],
  books_etc: ['書籍', 'book_title', 'publisher'],
  presentations: ['発表・講演', 'presentation_title', 'event'],
  awards: ['受賞', 'award_name', 'association'],
  research_projects: ['研究課題', 'research_project_title', 'system_name'],
  media_coverage: ['メディア', 'media_coverage_title', 'publisher'],
  social_contribution: ['社会貢献', 'social_contribution_title', 'event'],
  works: ['作品', 'work_title', 'event'],
};

const ja = (v: any): string | undefined => (v && typeof v === 'object' ? v.ja ?? v.en : v) || undefined;

async function getJson(url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function normalizePermalink(v: string): string {
  return v.replace(/^https?:\/\/researchmap\.jp\//, '').replace(/\/.*$/, '').trim();
}

async function fetchResearchmap(permalink: string): Promise<FeedItem[]> {
  const items: FeedItem[] = [];
  for (const [type, [kind, titleKey, venueKey]] of Object.entries(RM_TYPES)) {
    let url: string | undefined = `https://api.researchmap.jp/${permalink}/${type}?limit=100`;
    while (url) {
      const data: any = await getJson(url);
      for (const it of data.items ?? []) {
        const title = ja(it[titleKey]);
        const date = it.publication_date ?? it.award_date ?? it.from_event_date ?? it.from_date;
        if (!title || !date) continue;
        items.push({
          source: 'researchmap',
          kind,
          title,
          date: String(date),
          url: it.see_also?.[0]?.['@id'] ?? `https://researchmap.jp/${permalink}/${type}/${it['rm:id']}`,
          venue: venueKey ? ja(it[venueKey]) : undefined,
        });
      }
      const next = data._links?.next?.href;
      url = next ? new URL(next, 'https://api.researchmap.jp').href : undefined;
    }
  }
  return newest(items, MAX_PER_SOURCE);
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const text = (v: any): string => (typeof v === 'object' && v !== null ? v['#text'] ?? '' : String(v ?? '')).trim();

function toDate(v: string): string {
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

async function fetchFeed(feedUrl: string): Promise<FeedItem[]> {
  const res = await fetch(feedUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${feedUrl}`);
  const doc = xml.parse(await res.text());
  const channel = doc.rss?.channel ?? doc['rdf:RDF'];
  const kind = 'ブログ・記事';
  let items: FeedItem[];
  if (channel) {
    const siteTitle = text(channel.title ?? doc.rss?.channel?.title);
    items = arr(channel.item ?? doc['rdf:RDF']?.item).map((it: any) => ({
      source: feedUrl,
      kind,
      title: text(it.title),
      date: toDate(text(it.pubDate ?? it['dc:date'])),
      url: text(it.link),
      venue: siteTitle || undefined,
    }));
  } else if (doc.feed) {
    const siteTitle = text(doc.feed.title);
    items = arr(doc.feed.entry).map((it: any) => {
      const link = arr(it.link).find((l: any) => !l.rel || l.rel === 'alternate') ?? arr(it.link)[0];
      return {
        source: feedUrl,
        kind,
        title: text(it.title),
        date: toDate(text(it.published ?? it.updated)),
        url: link?.href,
        venue: siteTitle || undefined,
      };
    });
  } else {
    throw new Error(`RSS/Atom として読めません: ${feedUrl}`);
  }
  return newest(items.filter((i) => i.title && i.date), MAX_PER_SOURCE);
}

function newest(items: FeedItem[], n: number) {
  return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
}

async function readYaml(path: string, fallback: any = {}): Promise<any> {
  const src = await readFile(path, 'utf8').catch(() => '');
  return parseYaml(src) ?? fallback;
}

async function main() {
  await mkdir(FEEDS_DIR, { recursive: true });
  const only = process.argv[2];
  const slugs = (await readdir(TEACHERS_DIR))
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => f.replace(/\.yaml$/, ''))
    .filter((s) => !only || s === only);

  let failures = 0;
  for (const slug of slugs) {
    const fm = await readYaml(join(TEACHERS_DIR, `${slug}.yaml`));
    const sources: [string, () => Promise<FeedItem[]>][] = [];
    if (fm.researchmap) {
      const p = normalizePermalink(String(fm.researchmap));
      sources.push(['researchmap', () => fetchResearchmap(p)]);
    }
    for (const f of arr<string>(fm.feeds)) sources.push([f, () => fetchFeed(f)]);

    const outPath = join(FEEDS_DIR, `${slug}.yaml`);
    if (sources.length === 0) continue;

    const prev: FeedFile = await readYaml(outPath, { items: [] });
    const items: FeedItem[] = [];
    for (const [source, run] of sources) {
      try {
        const got = await run();
        items.push(...got);
        console.log(`  ${slug}: ${source} → ${got.length}件`);
      } catch (e) {
        failures++;
        const kept = prev.items.filter((i) => i.source === source);
        items.push(...kept);
        console.warn(`  ${slug}: ${source} 取得失敗（前回の${kept.length}件を保持）: ${(e as Error).message}`);
      }
    }
    const next =
      '# 自動生成（pnpm feeds）。手で編集しないでください\n' +
      stringify({ items: newest(items, MAX_PER_SOURCE * sources.length) }, { lineWidth: 0 });
    await writeFile(outPath, next);
  }
  if (failures) console.warn(`\n${failures}件のソースで取得に失敗しました`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
