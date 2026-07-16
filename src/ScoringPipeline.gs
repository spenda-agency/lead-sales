/**
 * 工程①: ハウスリストの行動スコアリング。
 * HubSpotから取得した各コンタクトの行動データをもとに、前回通知時点からの
 * 増分スコアを計算する。閾値を超えたコンタクトだけ、AI下書きを作成して
 * 「リード確認」シートに登録し(送信は既存の承認フローに乗せる)、
 * Slackに通知する。
 */
function runScoringPipeline() {
  ensureReviewSheet_();
  const sheet = ensureScoreTrackerSheet_();
  const scoringConfig = getScoringConfig_();
  const contacts = fetchHouseListContacts_();
  const existingRows = getScoreRowsByContactId_();
  const triggeredLeads = [];

  contacts.forEach(contact => {
    const existing = existingRows[String(contact.id)];

    if (!existing) {
      appendNewScoreRow_(sheet, contact);
      return;
    }

    const deltaViews = Math.max(0, contact.pageViews - Number(existing['基準ページビュー数'] || 0));
    const deltaOpens = Math.max(0, contact.emailOpens - Number(existing['基準メール開封数'] || 0));
    const score = deltaViews * scoringConfig.pointsPerVisit + deltaOpens * scoringConfig.pointsPerOpen;

    if (score > scoringConfig.threshold) {
      const lead = buildLeadFromScoredContact_(contact, deltaViews, deltaOpens, score);
      lead.draftText = generateDraftForLead_(lead);
      appendLeadToReviewSheet_(lead);
      triggeredLeads.push(lead);
      resetScoreRowAfterNotify_(sheet, existing.rowIndex_, contact);
    } else {
      updateScoreRowProgress_(sheet, existing.rowIndex_, contact, score);
    }
  });

  if (triggeredLeads.length > 0) {
    notifySlack_([
      '【ハウスリスト掘り起こし】行動スコアが閾値を超えた見込み客がいます。「リード確認」シートを確認してください。',
      ...triggeredLeads.map(l => `- ${l.company || l.contactName}: ${l.channelDetail}`),
    ].join('\n'));
  }

  Logger.log('runScoringPipeline完了: %d件が閾値超過', triggeredLeads.length);
  return triggeredLeads;
}

function buildLeadFromScoredContact_(contact, deltaViews, deltaOpens, score) {
  const now = new Date();
  return {
    sourceLabel: '④ハウスリスト掘り起こし',
    sourceId: `${contact.id}::${Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMddHHmmss')}`,
    company: contact.company,
    contactName: contact.contactName,
    email: contact.email,
    lineUserId: '',
    channelDetail: `直近の行動: サイト訪問+${deltaViews}回・メール開封+${deltaOpens}回(スコア${score}点)`,
    receivedAt: now,
  };
}
