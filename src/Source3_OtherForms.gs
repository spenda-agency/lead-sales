/**
 * ③他社のWEBサイトのフォーム経由
 * 既にスプレッドシート(Config.source3SheetName)に用意されている前提。
 * ①と同様、ヘッダー名の候補から拾う。フォームの入力項目は他社サイトごとに
 * 異なりやすいため、実際の列名に合わせて HEADER_CANDIDATES を調整すること。
 */
const SOURCE3_HEADER_CANDIDATES = {
  timestamp: ['タイムスタンプ', '受信日時', '日時'],
  company: ['会社名', '法人名'],
  contactName: ['氏名', 'お名前'],
  email: ['メールアドレス', 'Email', 'メール'],
  inquiry: ['お問い合わせ内容', '内容', 'メッセージ'],
  siteName: ['流入元サイト', 'サイト名', '掲載媒体'],
  id: ['ID', 'レコードID'],
};

function collectSource3Leads_() {
  const config = getConfig();
  const rows = readSheetAsObjects_(config.source3SheetName);
  const existing = getExistingSourceIds_();

  return rows
    .map(row => {
      const c = SOURCE3_HEADER_CANDIDATES;
      const email = firstNonEmpty_(row, c.email);
      const timestamp = firstNonEmpty_(row, c.timestamp);
      const explicitId = firstNonEmpty_(row, c.id);
      const sourceId = explicitId || Utilities.base64Encode(`${email}::${timestamp}::${row.rowIndex_}`);
      const siteName = firstNonEmpty_(row, c.siteName);
      const inquiry = firstNonEmpty_(row, c.inquiry);

      return {
        sourceLabel: '③他社フォーム経由',
        sourceId: String(sourceId),
        company: firstNonEmpty_(row, c.company),
        contactName: firstNonEmpty_(row, c.contactName),
        email: email,
        lineUserId: '',
        channelDetail: [siteName, inquiry].filter(Boolean).join(' / '),
        receivedAt: timestamp,
      };
    })
    .filter(lead => !existing['③他社フォーム経由::' + lead.sourceId]);
}
