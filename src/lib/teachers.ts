// 公式サイト由来（official）・先生の編集（teachers）・自動収集（feeds）・科目一覧（curriculum）を 1 人分にまとめる
import { getCollection, type CollectionEntry } from 'astro:content';
import { OFFICIAL_AUDIENCE, type AudienceId } from './taxonomy';
import { WEEK, type Day, type Slot } from './officeHours';

export type Official = CollectionEntry<'official'>['data'];
export type TeacherData = CollectionEntry<'teachers'>['data'];
export type CurriculumCourse = CollectionEntry<'curriculum'>['data'] & { id: string };
type OwnCourse = NonNullable<TeacherData['courses']>[number];

export type Activity = {
  kind: string;
  title: string;
  date: string;
  url?: string;
  venue?: string;
  own?: boolean; // 先生が自分で書いたトピック
};

/** 科目一覧の情報に、先生が YAML に書いた「作るもの・課題」などを重ねたもの */
export type Course = Partial<OwnCourse> & {
  name: string;
  anchor: string; // /courses/#<anchor>
  official?: CurriculumCourse;
  coTeachers: { name: string; slug?: string }[];
};

export type Teacher = {
  slug: string;
  official: Official;
  data: TeacherData;
  photo: string;
  specialty: string[];
  courses: Course[];
  activities: Activity[];
  /** カードやページ冒頭に出す一文: キャッチコピー > メッセージ > 公式サイトの見出し */
  headline?: string;
  /** オフィスアワーの枠（先生の YAML > 担当科目の記載から読み取ったもの） */
  ohSlots: (Slot & { place?: string; courses: string[] })[];
  /** 教員ページ標準化の項目の充足状況 */
  standard: { key: string; label: string; done: boolean }[];
};

// サイト内リンク。GitHub Pages のサブパス（/lab/）でも動くように必ずこれを通す
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const href = (path: string) => (/^https?:\/\//.test(path) ? path : `${BASE}${path}`);

export const REPO = 'https://github.com/Kaishi-info/lab';
export const editUrl = (slug: string) => `${REPO}/edit/main/teachers/${slug}.yaml`;
export const courseAnchor = (idOrName: string) => `course-${idOrName}`;

function standardOf(d: TeacherData, specialty: string[], courses: Course[]) {
  return [
    { key: 'catchcopy', label: 'キャッチコピー', done: !!d.catchcopy },
    { key: 'specialty', label: '専門分野', done: specialty.length > 0 },
    { key: 'courses', label: '担当科目', done: courses.length > 0 },
    { key: 'learn', label: '学べること', done: !!d.learn?.length },
    { key: 'research', label: '研究', done: !!(d.researchThemes?.length || d.researchmap) },
    { key: 'projects', label: 'プロジェクト', done: !!d.projects?.length },
  ];
}

/** 立場別のひとこと。先生が書いたもの > 公式サイトの「高校生／社会人のみなさんへ」 */
export function messageFor(t: Teacher, audience: AudienceId): { heading?: string; body: string } | undefined {
  const own = t.data.audiences?.[audience];
  if (own) return { body: own };
  const m = t.official.messages.find((m) => OFFICIAL_AUDIENCE[m.audience] === audience);
  return m && { heading: m.heading, body: m.body };
}

function mergeCourses(slug: string, own: OwnCourse[], curriculum: CurriculumCourse[]): Course[] {
  const used = new Set<string>();
  const merged: Course[] = curriculum
    .filter((c) => c.teachers.some((t) => t.slug === slug))
    .map((c) => {
      const o = own.find((x) => x.name === c.name);
      if (o) used.add(o.name);
      return {
        ...o,
        name: c.name,
        anchor: courseAnchor(c.id),
        official: c,
        summary: o?.summary ?? c.summary,
        term: o?.term ?? c.term,
        grade: o?.grade ?? c.grade,
        required: o?.required ?? c.required,
        coTeachers: c.teachers.filter((t) => t.slug !== slug),
      };
    });
  // 科目一覧にない授業（大学院・他大学など）は先生の YAML のまま
  const extra: Course[] = own
    .filter((o) => !used.has(o.name))
    .map((o) => ({ ...o, anchor: courseAnchor(o.name), coTeachers: [] }));
  return [...merged, ...extra];
}

const toMin = (t?: string) => (t ? Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]) : undefined);

function officeHourSlots(name: string, d: TeacherData, courses: Course[]): Teacher['ohSlots'] {
  // 先生が自分で書いたものがあれば、それだけを使う
  if (d.officeHours?.length) {
    return d.officeHours.flatMap((h) => {
      const start = toMin(h.start);
      const end = toMin(h.end);
      return h.day !== '随時' && start !== undefined && end !== undefined && end > start
        ? [{ day: h.day as Day, start, end, place: h.place, courses: [] }]
        : [];
    });
  }
  const slots: Teacher['ohSlots'] = [];
  const me = name.replace(/[\s\u3000]/g, '');
  for (const c of courses) {
    for (const s of c.official?.officeHours ?? []) {
      if (s.teacher?.replace(/[\s\u3000]/g, '') !== me) continue;
      const same = slots.find((x) => x.day === s.day && x.start === s.start && x.end === s.end);
      if (same) same.courses.push(c.name);
      else slots.push({ day: s.day, start: s.start, end: s.end, courses: [c.name] });
    }
  }
  return slots.sort((a, b) => WEEK.indexOf(a.day) - WEEK.indexOf(b.day) || a.start - b.start);
}

export async function getCurriculum(): Promise<CurriculumCourse[]> {
  return (await getCollection('curriculum')).map((c) => ({ ...c.data, id: c.id }));
}

export async function getTeachers(): Promise<Teacher[]> {
  const [entries, officials, feeds, curriculum] = await Promise.all([
    getCollection('teachers'),
    getCollection('official'),
    getCollection('feeds'),
    getCurriculum(),
  ]);
  const officialBySlug = new Map(officials.map((o) => [o.id, o.data]));
  const feedsBySlug = new Map(feeds.map((f) => [f.id, f.data.items]));

  return entries
    .filter((e) => officialBySlug.has(e.id) && !e.data.hidden)
    .map((entry) => {
      const official = officialBySlug.get(entry.id)!;
      const d = entry.data;
      const own: Activity[] = (d.topics ?? []).map((t) => ({ kind: 'トピック', title: t.title, date: t.date, url: t.url, own: true }));
      const activities = [...own, ...(feedsBySlug.get(entry.id) ?? [])].sort((a, b) => b.date.localeCompare(a.date));
      const specialty = d.specialty ?? official.specialty;
      const courses = mergeCourses(entry.id, d.courses ?? [], curriculum);
      return {
        slug: entry.id,
        official,
        data: d,
        photo: href(d.photo ?? official.photo),
        specialty,
        courses,
        activities,
        headline: d.catchcopy ?? d.message?.split('\n')[0] ?? official.messages[0]?.heading,
        ohSlots: officeHourSlots(official.name, d, courses),
        standard: standardOf(d, specialty, courses),
      };
    })
    .sort((a, b) => a.official.order - b.official.order);
}

// 2026-10-01 → 2026.10.01（researchmap は年・年月だけのこともある）
export const formatDate = (d: string) => d.replaceAll('-', '.');

/**
 * ページにまだ書かれていない項目から「先生に聞いてみたいこと」の候補を作る。
 * 質問フォームの選択肢と、先生ページの空欄の案内に使う（先生が書けば候補から消える）
 */
export function questionsFor(t: Teacher): { key: string; q: string }[] {
  const d = t.data;
  const qs: { key: string; q: string; missing: boolean }[] = [
    { key: 'learn', q: '先生の授業やゼミでは、どんなことが学べますか？', missing: !d.learn?.length },
    { key: 'make', q: '授業ではどんなものを作りますか？', missing: !t.courses.some((c) => c.make?.length) },
    { key: 'projects', q: 'いま取り組んでいる研究やプロジェクトを教えてください', missing: !d.projects?.length },
    { key: 'works', q: '学生はどんな作品や成果を生み出していますか？', missing: !d.works?.length },
    { key: 'message', q: 'どんな学生と一緒に学びたいですか？', missing: !d.message && !d.lookingFor?.length },
    { key: 'careers', q: 'この分野の学びは、どんな進路や仕事につながりますか？', missing: !d.careers?.length },
    { key: 'officeHours', q: '相談に行ける時間や方法を教えてください', missing: t.ohSlots.length === 0 },
  ];
  return qs.filter((x) => x.missing).map(({ key, q }) => ({ key, q }));
}
