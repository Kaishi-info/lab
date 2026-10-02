// 質問の通知先。環境変数に設定されたものすべてに送る（どれか 1 つでも届けば成功）
// - Resend（メール）: RESEND_API_KEY + ASK_TO（+ TEACHER_EMAILS で先生ごとの宛先）
// - Slack:   SLACK_WEBHOOK_URL   （Incoming Webhook）
// - Discord: DISCORD_WEBHOOK_URL
// - Teams:   TEAMS_WEBHOOK_URL   （Workflows の「Webhook 要求を受信したらチャネルに投稿」）

export type Question = {
  teacher: string;
  teacherName: string;
  course: string;
  question: string;
  role: string;
  name: string;
  email: string;
  page: string;
};

export type NotifyEnv = {
  RESEND_API_KEY?: string;
  ASK_FROM?: string;
  ASK_TO?: string;
  TEACHER_EMAILS?: string;
  SLACK_WEBHOOK_URL?: string;
  DISCORD_WEBHOOK_URL?: string;
  TEAMS_WEBHOOK_URL?: string;
};

const EDIT = (slug: string) => `https://github.com/Kaishi-info/lab/edit/main/teachers/${slug}.yaml`;
// チャットで全員に通知が飛ぶ書き方を無効にする
const defang = (s: string) => s.replace(/@(everyone|here|channel)/gi, '@​$1').replace(/<!/g, '<​!');

function lines(q: Question) {
  return [
    `科目: ${q.course || '（授業以外のこと）'}`,
    `立場: ${q.role || '（未回答）'}`,
    `お名前: ${q.name}`,
    `メール: ${q.email}`,
  ];
}

async function resend(env: NotifyEnv, q: Question) {
  if (!env.RESEND_API_KEY || !env.ASK_TO) return null;
  let emails: Record<string, string> = {};
  try {
    emails = env.TEACHER_EMAILS ? JSON.parse(env.TEACHER_EMAILS) : {};
  } catch {}
  const direct = emails[q.teacher];
  const text = [
    `${q.teacherName} 先生`,
    '',
    '情報デザイン学部の先生ページ（lab.kaishi.ac.jp）から質問が届きました。',
    'このメールに「返信」すると、質問した人に直接届きます。',
    ...(direct ? [] : [`※ 先生のアドレスが未登録のため、窓口に届いています。${q.teacherName}先生への転送をお願いします。`]),
    '',
    '──────────────',
    ...lines(q),
    '',
    q.question,
    '──────────────',
    `送信元ページ: ${q.page}`,
    '',
    'よく届く質問は、先生ページに書いておくと次の人の役に立ちます。',
    `ページの編集: ${EDIT(q.teacher)}`,
  ].join('\n');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.ASK_FROM || '開志創造大学 情報デザイン学部 <onboarding@resend.dev>',
      to: [direct ?? env.ASK_TO],
      reply_to: q.email,
      subject: `【先生に聞いてみる】${q.name}さんから${q.teacherName}先生へ${q.course ? `（${q.course}）` : ''}`,
      text,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status} ${await res.text()}`);
  return 'resend';
}

async function post(url: string, payload: unknown, name: string) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`${name} ${res.status} ${await res.text()}`);
  return name;
}

const title = (q: Question) => `${q.name}さん（${q.role || '立場未回答'}）から ${q.teacherName}先生へ`;

async function slack(env: NotifyEnv, q: Question) {
  if (!env.SLACK_WEBHOOK_URL) return null;
  const t = defang;
  return post(
    env.SLACK_WEBHOOK_URL,
    {
      text: t(`先生に聞いてみる: ${title(q)}`),
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: t(`先生に聞いてみる: ${q.teacherName}先生`).slice(0, 150) } },
        { type: 'section', text: { type: 'mrkdwn', text: t(lines(q).join('\n')) } },
        { type: 'section', text: { type: 'plain_text', text: t(q.question) } },
        { type: 'context', elements: [{ type: 'mrkdwn', text: `<${EDIT(q.teacher)}|ページを編集> ・ ${t(q.page)}` }] },
      ],
    },
    'slack',
  );
}

async function discord(env: NotifyEnv, q: Question) {
  if (!env.DISCORD_WEBHOOK_URL) return null;
  return post(
    env.DISCORD_WEBHOOK_URL,
    {
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: `先生に聞いてみる: ${q.teacherName}先生`.slice(0, 256),
          description: q.question.slice(0, 4000),
          fields: [
            { name: '科目', value: q.course || '（授業以外のこと）', inline: true },
            { name: '立場', value: q.role || '（未回答）', inline: true },
            { name: 'お名前', value: q.name, inline: true },
            { name: 'メール', value: q.email, inline: true },
          ],
          url: EDIT(q.teacher),
          color: 0x4f6bff,
        },
      ],
    },
    'discord',
  );
}

async function teams(env: NotifyEnv, q: Question) {
  if (!env.TEAMS_WEBHOOK_URL) return null;
  return post(
    env.TEAMS_WEBHOOK_URL,
    {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
              { type: 'TextBlock', size: 'Medium', weight: 'Bolder', text: `先生に聞いてみる: ${q.teacherName}先生`, wrap: true },
              { type: 'FactSet', facts: lines(q).map((l) => ({ title: l.split(': ')[0], value: l.split(': ').slice(1).join(': ') })) },
              { type: 'TextBlock', text: q.question, wrap: true },
            ],
            actions: [{ type: 'Action.OpenUrl', title: 'ページを編集', url: EDIT(q.teacher) }],
          },
        },
      ],
    },
    'teams',
  );
}

/** 設定されている通知先すべてに送る。返り値は届いた先の名前 */
export async function notify(env: NotifyEnv, q: Question): Promise<{ sent: string[]; errors: string[] }> {
  const results = await Promise.allSettled([resend(env, q), slack(env, q), discord(env, q), teams(env, q)]);
  const sent: string[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) sent.push(r.value);
    if (r.status === 'rejected') errors.push(String(r.reason));
  }
  return { sent, errors };
}
