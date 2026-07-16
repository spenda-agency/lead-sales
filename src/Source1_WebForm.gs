/**
 * ①ホームページからの問い合わせ
 * 既にスプレッドシート(GAS経由)とHubSpotの両方に集まっている前提。
 * ここでは追加の外部API連携をせず、既存のスプレッドシートタブ
 * (Config.source1SheetName)を正として新規行を拾う。
 * ヘッダー名は会社ごとに表記ゆれがあるため、候補から最初に見つかったものを使う。
 * 実際のシートの列名に合わせて HEADER_CANDIDATES を調整すること。
 */
const SOURCE1_HEADER_CANDIDATES = {
  timestamp: ['タイムスタンプ', '受信日時', '日時'],
  company: ['会社名', '法人名', '御社名'],
  contactName: ['氏名', 'お名前', '担当者名'],
  email: ['メールアドレス', 'Email', 'メール'],
  inquiry: ['お問い合わせ内容', '問い合わせ内容', 'ご相談内容', 'メッセージ'],
  id: ['ID', 'HubSpot Contact ID', 'レコードID'],
};

function collectSource1Leads_() {
  const config = getConfig();
  const rows = readSheetAsObjects_(config.source1SheetName);
  const existing = getExistingSourceIds_();

  return rows
    .map(row => {
      const c = SOURCE1_HEADER_CANDIDATES;
      const email = firstNonEmpty_(row, c.email);
      const timestamp = firstNonEmpty_(row, c.timestamp);
      const explicitId = firstNonEmpty_(row, c.id);
      const sourceId = explicitId || Utilities.base64Encode(`${email}::${timestamp}::${row.rowIndex_}`);

      return {
        sourceLabel: '①HP問い合わせ',
        sourceId: String(sourceId),
        company: firstNonEmpty_(row, c.company),
        contactName: firstNonEmpty_(row, c.contactName),
        email: email,
        lineUserId: '',
        channelDetail: firstNonEmpty_(row, c.inquiry),
        receivedAt: timestamp,
      };
    })
    .filter(lead => !existing['①HP問い合わせ::' + lead.sourceId]);
}
