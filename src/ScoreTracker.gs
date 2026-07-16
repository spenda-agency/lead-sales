/**
 * 「ハウスリストスコア」シート: コンタクトごとに
 * - 現在の累積値(HubSpotから取得した最新値)
 * - 基準値(前回通知した時点の値。ここからの増分だけをスコアとして数える)
 * - 未通知スコア(基準値からの増分に配点をかけた値)
 * を保持する。閾値を超えたら通知し、基準値をその時点の値にリセットする
 * ことで、「また新しい反応があったら再度知らせる」を実現する。
 */
const SCORE_TRACKER_HEADERS = [
  'HubSpotコンタクトID', '会社名', '氏名', 'メールアドレス', '役職',
  '現在ページビュー数', '現在メール開封数',
  '基準ページビュー数', '基準メール開封数',
  '未通知スコア', '最終通知日時', '最終確認日時',
];

function ensureScoreTrackerSheet_() {
  const config = getConfig();
  return ensureSheetWithHeaders_(config.scoreSheetName, SCORE_TRACKER_HEADERS);
}

function getScoreRowsByContactId_() {
  const config = getConfig();
  const rows = readSheetAsObjects_(config.scoreSheetName);
  const map = {};
  rows.forEach(row => { map[String(row['HubSpotコンタクトID'])] = row; });
  return map;
}

/** 初めて見るコンタクト: 基準値=現在値として登録する(過去分を突然のスコアにしない) */
function appendNewScoreRow_(sheet, contact) {
  appendRowByHeaders_(sheet, SCORE_TRACKER_HEADERS, {
    'HubSpotコンタクトID': contact.id,
    '会社名': contact.company,
    '氏名': contact.contactName,
    'メールアドレス': contact.email,
    '役職': contact.jobtitle,
    '現在ページビュー数': contact.pageViews,
    '現在メール開封数': contact.emailOpens,
    '基準ページビュー数': contact.pageViews,
    '基準メール開封数': contact.emailOpens,
    '未通知スコア': 0,
    '最終通知日時': '',
    '最終確認日時': new Date(),
  });
}

/** 閾値未満: 現在値と未通知スコアだけ更新し、基準値は維持する(引き続き積み上げる) */
function updateScoreRowProgress_(sheet, rowIndex, contact, score) {
  updateRowByHeaders_(sheet, rowIndex, {
    '会社名': contact.company,
    '氏名': contact.contactName,
    'メールアドレス': contact.email,
    '役職': contact.jobtitle,
    '現在ページビュー数': contact.pageViews,
    '現在メール開封数': contact.emailOpens,
    '未通知スコア': score,
    '最終確認日時': new Date(),
  });
}

/** 閾値超過で通知済み: 基準値を現在値にリセットし、未通知スコアを0に戻す */
function resetScoreRowAfterNotify_(sheet, rowIndex, contact) {
  updateRowByHeaders_(sheet, rowIndex, {
    '現在ページビュー数': contact.pageViews,
    '現在メール開封数': contact.emailOpens,
    '基準ページビュー数': contact.pageViews,
    '基準メール開封数': contact.emailOpens,
    '未通知スコア': 0,
    '最終通知日時': new Date(),
    '最終確認日時': new Date(),
  });
}
