// 学部全体で共通の分類。増やすときはここを編集する（PR で教務・カリキュラム担当が確認）

// 教育・研究領域のクラスタ（学長戦略 Layer 2）
export const CLUSTERS = {
  'generative-ai': { label: 'AI / Generative AI', ja: 'AI・生成AI' },
  'ui-ux': { label: 'UI / UX', ja: 'UI・UXデザイン' },
  hci: { label: 'HCI', ja: 'ヒューマン・コンピュータ・インタラクション' },
  'data-viz': { label: 'Data Visualization', ja: '情報可視化・データ' },
  'creative-coding': { label: 'Creative Coding', ja: 'クリエイティブコーディング' },
  'media-design': { label: 'Media Design', ja: 'メディアデザイン・コンテンツ制作' },
  'communication-design': { label: 'Communication Design', ja: 'コミュニケーションデザイン' },
  'social-design': { label: 'Social Design', ja: 'ソーシャルデザイン・社会課題' },
  'digital-business': { label: 'Digital Business', ja: 'デジタルビジネス・経営' },
  xr: { label: 'XR / Spatial Computing', ja: 'XR・空間コンピューティング' },
} as const;
export type ClusterId = keyof typeof CLUSTERS;
export const CLUSTER_IDS = Object.keys(CLUSTERS) as [ClusterId, ...ClusterId[]];

// 立場別の入口（学長戦略 課題C / Phase 4）
export const AUDIENCES = {
  'high-school': {
    label: '高校生',
    lead: '大学で何を学べて、どんな先生がいて、入学したら何を作れるのか。',
    wants: ['何を学べるか', '自分に合う先生', '授業の雰囲気', '入学後の姿'],
  },
  adult: {
    label: '社会人',
    lead: '働きながら、学び直しで次のキャリアへ。仕事に直結するテーマを持つ先生たち。',
    wants: ['仕事に活かせるか', '学び直しのテーマ', 'オンラインで続けられるか'],
  },
  vocational: {
    label: '専門学校併修',
    lead: '専門学校での学びと大学の学びをつなげる。併修で広がる選択肢。',
    wants: ['専門分野との接続', '学位取得', '制作の幅'],
  },
  overseas: {
    label: '海外在住者',
    lead: '場所と時間を選ばずに、日本の大学で情報デザインを学ぶ。',
    wants: ['オンラインでの学び', '国際的な活動', '日本語での学修'],
  },
  parents: {
    label: '保護者',
    lead: 'どんな先生が、どんな授業で、どんな力を育てているのか。',
    wants: ['教育の質', '先生の専門性', '卒業後の進路'],
  },
  'school-teachers': {
    label: '高校・専門学校の先生',
    lead: '探究学習、出前授業、PBL、共同企画。高大連携の入口です。',
    wants: ['探究学習との接続', '出前授業', 'PBL・共同企画'],
  },
  companies: {
    label: '企業・自治体',
    lead: '学部の研究領域と、共同研究・学生との連携の機会。',
    wants: ['研究領域', '共同研究', '学生との連携'],
  },
  researchers: {
    label: '研究者',
    lead: '研究テーマ、論文、共同研究の可能性。',
    wants: ['研究テーマ', '業績', '共同研究'],
  },
} as const;
export type AudienceId = keyof typeof AUDIENCES;
export const AUDIENCE_IDS = Object.keys(AUDIENCES) as [AudienceId, ...AudienceId[]];

// 公式サイトの「高校生のみなさんへ」「社会人のみなさんへ」を立場に対応づける
export const OFFICIAL_AUDIENCE: Record<string, AudienceId> = {
  高校生のみなさんへ: 'high-school',
  社会人のみなさんへ: 'adult',
};

// 「参加・相談の入口」の種類（テンプレート 8. Contact / Join）
export const JOIN_TYPES = ['授業', 'ゼミ', '研究', 'プロジェクト', '高大連携', '共同研究', '取材・講演'] as const;
// 立場ごとに目立たせる入口
export const JOIN_FOR: Partial<Record<AudienceId, readonly (typeof JOIN_TYPES)[number][]>> = {
  'school-teachers': ['高大連携', 'プロジェクト'],
  companies: ['共同研究', 'プロジェクト', '取材・講演'],
  researchers: ['共同研究', '研究'],
};

// 証拠の種類（学長戦略 Strategy 3「抽象語ではなく証拠を見せる」）
export const EVIDENCE_KINDS = ['動画', 'スライド', '課題例', '作品', 'コード', 'データ', '論文', '展示', 'プロジェクト', '学生コメント', '社会連携', '記事'] as const;
