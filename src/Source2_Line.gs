/**
 * ②LINE公式アカウントの登録者
 * LINE公式アカウント管理画面には友だち一覧が表示されるが、Messaging APIには
 * 「全友だちの名前一覧をまとめて取得するAPI」は存在しない。
 * そのため、LineWebhook.gs の doPost で「友だち追加(follow)イベント」を
 * 受け取った時点でプロフィールを取得し、このシート(Config.source2SheetName)に
 * 追記する運用にしている。ここではそのシートから新規行を拾うだけを行う。
 */
const SOURCE2_HEADER_CANDIDATES = {
  timestamp: ['登録日時', 'タイムスタンプ'],
  displayName: ['表示名', '氏名', 'お名前'],
  userId: ['LINEユーザーID', 'userId', 'ユーザーID'],
  note: ['メモ', '流入経路', '備考'],
};

function collectSource2Leads_() {
  const config = getConfig();
  const rows = readSheetAsObjects_(config.source2SheetName);
  const existing = getExistingSourceIds_();

  return rows
    .map(row => {
      const c = SOURCE2_HEADER_CANDIDATES;
      const userId = firstNonEmpty_(row, c.userId);

      return {
        sourceLabel: '②LINE登録者',
        sourceId: String(userId),
        company: '',
        contactName: firstNonEmpty_(row, c.displayName),
        email: '',
        lineUserId: userId,
        channelDetail: firstNonEmpty_(row, c.note) || 'LINE公式アカウント登録',
        receivedAt: firstNonEmpty_(row, c.timestamp),
      };
    })
    .filter(lead => lead.sourceId && !existing['②LINE登録者::' + lead.sourceId]);
}
