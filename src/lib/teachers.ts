// 公式サイト由来（official）・先生の編集（teachers）・自動収集（feeds）を 1 人分にまとめる
import { getCollection, type CollectionEntry } from 'astro:content';

export type Official = CollectionEntry<'official'>['data'];
export type TeacherData = CollectionEntry<'teachers'>['data'];

export type Activity = {
  kind: string;
  title: string;
  date: string;
  url?: string;
  venue?: string;
  own?: boolean; // 先生が自分で書いたトピック
};

export type Teacher = {
  slug: string;
  official: Official;
  data: TeacherData;
  photo: string;
  specialty: string[];
  activities: Activity[];
};

export const REPO = 'https://github.com/Kaishi-info/lab';
export const editUrl = (slug: string) => `${REPO}/edit/main/teachers/${slug}.yaml`;

export async function getTeachers(): Promise<Teacher[]> {
  const [entries, officials, feeds] = await Promise.all([
    getCollection('teachers'),
    getCollection('official'),
    getCollection('feeds'),
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
      return {
        slug: entry.id,
        official,
        data: d,
        photo: d.photo ?? official.photo,
        specialty: d.specialty ?? official.specialty,
        activities,
      };
    })
    .sort((a, b) => a.official.order - b.official.order);
}

// 2026-10-01 → 2026.10.01（researchmap は年・年月だけのこともある）
export const formatDate = (d: string) => d.replaceAll('-', '.');
