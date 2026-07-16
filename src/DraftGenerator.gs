/**
 * リード情報から、1件ごとにパーソナライズしたファーストコンタクトの
 * メール/LINEメッセージ下書きを作る。
 * 社内マニュアルの共通ルール「AIに渡す情報は分かっている範囲で可能な限り多く渡す」
 * に従い、lead に入っている情報はすべてプロンプトに含める。
 */
function generateDraftForLead_(lead) {
  const prompt = buildDraftPrompt_(lead);
  const aiDraft = callClaude_(prompt);
  if (aiDraft) return aiDraft;
  return buildTemplateDraft_(lead);
}

function buildDraftPrompt_(lead) {
  const config = getConfig();
  const channel = lead.lineUserId ? 'LINE公式アカウントのメッセージ' : 'メール';

  return [
    `あなたは${config.companyName}の営業担当者${config.senderName}の下書き作成を手伝うアシスタントです。`,
    `以下の情報を持つ見込み客に対して、初回コンタクトの${channel}文面を1通、日本語で作成してください。`,
    '',
    '# 見込み客情報',
    `取得経路: ${lead.sourceLabel}`,
    `会社名/氏名: ${lead.company || '(不明)'}`,
    `担当者名: ${lead.contactName || '(不明)'}`,
    `メールアドレス: ${lead.email || '(不明)'}`,
    `問い合わせ・登録の詳細: ${lead.channelDetail || '(情報なし)'}`,
    `受信日時: ${lead.receivedAt || '(不明)'}`,
    '',
    '# 作成方針',
    '- なぜ今この相手に連絡するのが適切かを、渡された情報から一言添える',
    '- 自社サービスがなぜこの相手に有効そうかを、分かる範囲で具体的に触れる',
    '- 一方的な売り込みにせず、相手の状況を尋ねる一文を含める',
    '- 事実として渡されていない情報は憶測で書かない',
    channel === 'メール'
      ? '- 件名と本文をセットで出力する'
      : '- LINEメッセージとして自然な長さ(短文)にする',
  ].join('\n');
}

/** Claude APIキー未設定時の最低限のフォールバック下書き */
function buildTemplateDraft_(lead) {
  const config = getConfig();
  if (lead.lineUserId) {
    return [
      `${lead.contactName || lead.company || 'お客'}様`,
      '',
      `この度は${config.companyName}の公式LINEにご登録いただきありがとうございます。`,
      'ご不明な点やお困りごとがございましたら、お気軽にこちらへご返信ください。',
      '',
      `${config.senderName}`,
    ].join('\n');
  }

  return [
    `件名: ${lead.company || 'お客'}様 お問い合わせありがとうございます`,
    '',
    `${lead.company || ''} ${lead.contactName || ''}様`,
    '',
    `この度はお問い合わせいただき誠にありがとうございます。${config.companyName}の${config.senderName}と申します。`,
    (lead.channelDetail ? `いただいた内容「${lead.channelDetail}」について、担当より改めてご案内させていただきます。` : ''),
    '',
    'ご都合の良い日時をお知らせいただけますと幸いです。',
    '',
    `${config.senderName}`,
  ].filter(Boolean).join('\n');
}
