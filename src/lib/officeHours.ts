// 科目一覧のオフィスアワー（自由記述）から「曜日・開始・終了」を取り出す。
// 例: "火曜日13時～14時／木曜日19時～21時" "水曜・金曜 13：30～17：30" "火曜日 10:00-11:30 / 18:30-20:00" "水曜日16時半～18時"
// 読み取れない書き方（「週に3時間設ける」など）は空配列を返し、元の文章をそのまま表示する。

export const WEEK = ['月', '火', '水', '木', '金', '土', '日'] as const;
export type Day = (typeof WEEK)[number];
export type Slot = { day: Day; start: number; end: number }; // 分（0:00 からの分数）

const toHalf = (s: string) =>
  s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ':')
    .replace(/[－−ー―‐]/g, '-')
    .replace(/[〜～~]/g, '-');

// 「13時」「13:30」「13時30分」「16時半」→ 分
const TIME = String.raw`(\d{1,2})(?:\s*(?::|時)\s*(\d{1,2}|半)?\s*分?\s*時?)?`;
const RANGE = new RegExp(`${TIME}\\s*-+\\s*${TIME}`, 'g');
// 「曜日」の「日」を日曜と読まないように
const DAYS_RE = /(?<!曜)([月火水木金土日])(?:曜日?)?(?:\s*[・、,]\s*([月火水木金土日])(?:曜日?)?)*/g;
const toMin = (h: string, m?: string) => Number(h) * 60 + (m === '半' ? 30 : m ? Number(m) : 0);

export function parseOfficeHours(text: string): Slot[] {
  const s = toHalf(text);
  // 「4/18（土）」のような日付指定は毎週の枠ではないので読まない
  if (/\d{1,2}\/\d{1,2}(・\d{1,2})*\s*[（(]/.test(s)) return [];
  const slots: Slot[] = [];
  let days: Day[] = [];
  // 曜日の出現位置と時間帯の出現位置を左から順に読む
  const tokens = [
    ...[...s.matchAll(DAYS_RE)].map((m) => ({
      i: m.index!,
      days: [...m[0].replace(/曜日?/g, '').matchAll(/[月火水木金土日]/g)].map((x) => x[0] as Day),
    })),
    ...[...s.matchAll(RANGE)].map((m) => ({
      i: m.index!,
      range: [toMin(m[1], m[2]), toMin(m[3], m[4])] as const,
    })),
  ].sort((a, b) => a.i - b.i);

  for (const t of tokens) {
    if ('days' in t) days = t.days;
    else if (days.length && t.range[1] > t.range[0] && t.range[1] <= 24 * 60) {
      for (const day of days) slots.push({ day, start: t.range[0], end: t.range[1] });
    }
  }
  // 重複を除く
  return slots.filter((x, i) => slots.findIndex((y) => y.day === x.day && y.start === x.start && y.end === x.end) === i);
}

/**
 * 「正畑：火曜日…、西田：火曜日…」のように先生ごとに書き分けられている場合は、名前ごとに分けて読む。
 * familyNames に一致する名前が無ければ全体を 1 つとして読む。
 */
export function parseByTeacher(text: string, familyNames: string[]): Map<string | undefined, Slot[]> {
  const s = toHalf(text);
  const marks = [...s.matchAll(/([^\s:：、,/／]+)\s*[:：]/g)]
    .map((m) => ({ i: m.index!, end: m.index! + m[0].length, name: familyNames.find((n) => m[1].startsWith(n)) }))
    .filter((m) => m.name);
  const out = new Map<string | undefined, Slot[]>();
  if (!marks.length) {
    out.set(undefined, parseOfficeHours(s));
    return out;
  }
  marks.forEach((m, k) => out.set(m.name, parseOfficeHours(s.slice(m.end, marks[k + 1]?.i ?? s.length))));
  return out;
}

export const fmt = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
