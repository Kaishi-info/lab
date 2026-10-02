// POST /api/ask — 「先生に聞いてみる」フォームの送信を受け取り、設定された通知先（Resend / Slack / Discord / Teams）に送る
// Cloudflare Pages Functions（サイトと同じドメインで動く）
// - 先生のメールアドレスや Webhook URL は公開リポジトリに置かず、Pages の環境変数（Secrets）で持つ
// - 質問した人には送らない（入力されたアドレスに大学名義のメールを送れる踏み台にしないため）。先生は「返信」で答える
// - 迷惑送信対策: 同じサイトからの送信だけ受け付ける、隠し項目（honeypot）、IP ごとの回数制限（簡易）、文字数の上限、任意で Turnstile
import { notify, type NotifyEnv } from '../_lib/notify';

type Env = NotifyEnv & { TURNSTILE_SECRET?: string };
type Ctx = { request: Request; env: Env };

const LIMITS = { teacherName: 40, course: 80, question: 2000, role: 40, name: 60, email: 200, page: 300 } as const;
const EMAIL = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/;

// 簡易の回数制限（同じ IP から 1 分に 3 回まで）。インスタンスごとの記録なので目安
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 3;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim().slice(0, max) : '');

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  // 同じサイトのページから送られたものだけ受け付ける
  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).host !== new URL(request.url).host) return json({ error: 'origin' }, 403);

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (limited(ip)) return json({ error: 'rate', message: '短い時間に送信が続いています。少し待ってからもう一度送ってください。' }, 429);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'json' }, 400);
  }
  // ボットには成功したふりをする
  if (body.website) return json({ ok: true });

  const q = {
    teacher: clean(body.teacher, 60),
    teacherName: clean(body.teacherName, LIMITS.teacherName),
    course: clean(body.course, LIMITS.course),
    question: clean(body.question, LIMITS.question),
    role: clean(body.role, LIMITS.role),
    name: clean(body.name, LIMITS.name),
    email: clean(body.email, LIMITS.email),
    page: clean(body.page, LIMITS.page),
  };
  if (!/^[a-z0-9-]+$/.test(q.teacher) || !q.teacherName || !q.question || !q.name || !EMAIL.test(q.email)) {
    return json({ error: 'invalid', message: '入力に足りないところがあります。' }, 400);
  }

  if (env.TURNSTILE_SECRET) {
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET);
    form.append('response', clean(body.turnstile, 2048));
    form.append('remoteip', ip);
    const v = (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form }).then((r) => r.json())) as {
      success: boolean;
    };
    if (!v.success) return json({ error: 'turnstile', message: '確認に失敗しました。ページを読み込み直してください。' }, 400);
  }

  const { sent, errors } = await notify(env, q);
  if (errors.length) console.error('notify', errors);
  if (sent.length === 0) {
    return json({ error: 'send', message: '送信できませんでした。時間をおいてもう一度お試しください。' }, errors.length ? 502 : 503);
  }
  return json({ ok: true });
}
