// 「先生に聞いてみる」フォームを受け取り、Resend で先生（または学部の窓口）にメールを送る。
// - 送り先のアドレスは公開リポジトリに置かず、Secrets（TEACHER_EMAILS / ASK_TO）で持つ
// - 質問した人には送らない（入力されたアドレスに大学名義のメールを送れる踏み台にしないため）。先生は「返信」で答える
// - 迷惑送信対策: 送信元サイトの確認、隠し項目（honeypot）、IP ごとの回数制限、文字数の上限、任意で Turnstile

interface Env {
  ALLOWED_ORIGINS: string;
  ASK_FROM: string;
  RESEND_API_KEY: string;
  ASK_TO: string;
  TEACHER_EMAILS?: string;
  TURNSTILE_SECRET?: string;
  ASK_LIMIT: { limit(opts: { key: string }): Promise<{ success: boolean }> };
}

type Ask = {
  teacher: string; // slug
  teacherName: string;
  course?: string;
  question: string;
  role?: string;
  name: string;
  email: string;
  page?: string;
  website?: string; // honeypot（人には見えない。入っていたらボット）
  turnstile?: string;
};

const LIMITS = { teacherName: 40, course: 80, question: 2000, role: 40, name: 60, email: 200, page: 300 } as const;
const EMAIL = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/;

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(origin && { 'access-control-allow-origin': origin, vary: 'origin' }),
    },
  });

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim().slice(0, max) : '';
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('origin');
    const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
    const okOrigin = origin && allowed.includes(origin) ? origin : null;

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: okOrigin ? 204 : 403,
        headers: okOrigin
          ? { 'access-control-allow-origin': okOrigin, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' }
          : {},
      });
    }
    if (req.method !== 'POST') return json({ error: 'method' }, 405, okOrigin);
    if (!okOrigin) return json({ error: 'origin' }, 403, null);

    const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
    if (!(await env.ASK_LIMIT.limit({ key: ip })).success) return json({ error: 'rate', message: '短い時間に送信が続いています。少し待ってからもう一度送ってください。' }, 429, okOrigin);

    let body: Ask;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'json' }, 400, okOrigin);
    }
    // ボットには成功したふりをする
    if (body.website) return json({ ok: true }, 200, okOrigin);

    const a = {
      teacher: clean(body.teacher, 60),
      teacherName: clean(body.teacherName, LIMITS.teacherName),
      course: clean(body.course, LIMITS.course),
      question: clean(body.question, LIMITS.question),
      role: clean(body.role, LIMITS.role),
      name: clean(body.name, LIMITS.name),
      email: clean(body.email, LIMITS.email),
      page: clean(body.page, LIMITS.page),
    };
    if (!/^[a-z0-9-]+$/.test(a.teacher) || !a.teacherName || !a.question || !a.name || !EMAIL.test(a.email)) {
      return json({ error: 'invalid', message: '入力に足りないところがあります。' }, 400, okOrigin);
    }

    if (env.TURNSTILE_SECRET) {
      const form = new FormData();
      form.append('secret', env.TURNSTILE_SECRET);
      form.append('response', clean(body.turnstile, 2048));
      form.append('remoteip', ip);
      const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form }).then((r) => r.json<{ success: boolean }>());
      if (!v.success) return json({ error: 'turnstile', message: '確認に失敗しました。ページを読み込み直してください。' }, 400, okOrigin);
    }

    let emails: Record<string, string> = {};
    try {
      emails = env.TEACHER_EMAILS ? JSON.parse(env.TEACHER_EMAILS) : {};
    } catch {}
    const direct = emails[a.teacher];
    const to = direct ?? env.ASK_TO;

    const subject = `【先生に聞いてみる】${a.name}さんから${a.teacherName}先生へ${a.course ? `（${a.course}）` : ''}`;
    const text = [
      `${a.teacherName} 先生`,
      '',
      '情報デザイン学部の先生ページ（lab.kaishi.ac.jp）から質問が届きました。',
      'このメールに「返信」すると、質問した人に直接届きます。',
      direct ? '' : `※ 先生のアドレスが未登録のため、窓口（${env.ASK_TO}）に届いています。先生への転送をお願いします。`,
      '',
      '──────────────',
      `科目: ${a.course || '（授業以外のこと）'}`,
      `立場: ${a.role || '（未回答）'}`,
      `お名前: ${a.name}`,
      `メール: ${a.email}`,
      '',
      a.question,
      '──────────────',
      a.page ? `送信元ページ: ${a.page}` : '',
      '',
      'よく届く質問は、先生ページに書いておくと次の人の役に立ちます。',
      `ページの編集: https://github.com/Kaishi-info/lab/edit/main/teachers/${a.teacher}.yaml`,
    ]
      .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
      .join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.ASK_FROM, to: [to], reply_to: a.email, subject, text }),
    });
    if (!res.ok) {
      console.error('resend', res.status, await res.text());
      return json({ error: 'send', message: '送信できませんでした。時間をおいてもう一度お試しください。' }, 502, okOrigin);
    }
    return json({ ok: true }, 200, okOrigin);
  },
};
