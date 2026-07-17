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
  const config = getConfig();
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
    const openEvents = countEmailOpenEvents_(
      contact.emailOpenValue, Number(existing['基準メール開封シグナル'] || 0), config.hubspotEmailOpenPropertyType
    );
    const score = deltaViews * scoringConfig.pointsPerVisit + openEvents * scoringConfig.pointsPerOpen;

    if (score > scoringConfig.threshold) {
      const lead = buildLeadFromScoredContact_(contact, deltaViews, openEvents, score, config.hubspotEmailOpenPropertyType);
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

/**
 * 'count'(累積カウント)なら基準値からの増分そのものをイベント数として扱う。
 * 'date'(直近開封日時)は件数を区別できないため、基準日時より新しい開封が
 * あれば1件のみとして扱う(Sales Hub Starterの制約による割り切り)。
 */
function countEmailOpenEvents_(currentValue, baselineValue, type) {
  if (type === 'count') return Math.max(0, currentValue - baselineValue);
  return currentValue > baselineValue ? 1 : 0;
}

function buildLeadFromScoredContact_(contact, deltaViews, openEvents, score, emailOpenType) {
  const now = new Date();
  const openText = emailOpenType === 'count'
    ? `メール開封+${openEvents}回`
    : (openEvents > 0 ? 'メール新規開封あり' : 'メール開封なし');

  return {
    sourceLabel: '④ハウスリスト掘り起こし',
    sourceId: `${contact.id}::${Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMddHHmmss')}`,
    company: contact.company,
    contactName: contact.contactName,
    email: contact.email,
    lineUserId: '',
    channelDetail: `直近の行動: サイト訪問+${deltaViews}回・${openText}(スコア${score}点)`,
    receivedAt: now,
  };
}
