/**
 * 「リード確認」シート: ①②③すべてのリードを集約し、
 * AI下書き作成 → 人の確認・承認 → 送信 の状態を1行1リードで管理する。
 */
const REVIEW_HEADERS = [
  '取得元', '取得元ID', '会社名/氏名', '担当者名', 'メールアドレス',
  'LINEユーザーID', '流入経路詳細', '受信日時', 'ステータス',
  'AI下書き', '承認', '送信済み', '送信日時', '登録日時',
];

function ensureReviewSheet_() {
  const config = getConfig();
  const sheet = ensureSheetWithHeaders_(config.reviewSheetName, REVIEW_HEADERS);
  insertApprovalCheckboxes_(sheet);
  return sheet;
}

/** 「承認」「送信済み」列にチェックボックスを設定し、人が押しやすくする */
function insertApprovalCheckboxes_(sheet) {
  const approvalCol = REVIEW_HEADERS.indexOf('承認') + 1;
  const sentCol = REVIEW_HEADERS.indexOf('送信済み') + 1;
  const maxRows = Math.max(sheet.getMaxRows(), 1000);
  const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  sheet.getRange(2, approvalCol, maxRows - 1, 1).setDataValidation(rule);
  sheet.getRange(2, sentCol, maxRows - 1, 1).setDataValidation(rule);
}

/** 既にレビューシートに存在する「取得元ID」の集合を返す（重複登録防止） */
function getExistingSourceIds_() {
  const config = getConfig();
  const rows = readSheetAsObjects_(config.reviewSheetName);
  const set = {};
  rows.forEach(r => {
    const key = String(r['取得元']) + '::' + String(r['取得元ID']);
    set[key] = true;
  });
  return set;
}

/**
 * 新規リードをレビューシートに追加する。
 * lead: { sourceLabel, sourceId, company, contactName, email, lineUserId,
 *         channelDetail, receivedAt, draftText }
 */
function appendLeadToReviewSheet_(lead) {
  const sheet = ensureReviewSheet_();
  appendRowByHeaders_(sheet, REVIEW_HEADERS, {
    '取得元': lead.sourceLabel,
    '取得元ID': lead.sourceId,
    '会社名/氏名': lead.company,
    '担当者名': lead.contactName,
    'メールアドレス': lead.email,
    'LINEユーザーID': lead.lineUserId,
    '流入経路詳細': lead.channelDetail,
    '受信日時': lead.receivedAt,
    'ステータス': '下書き作成済み(未承認)',
    'AI下書き': lead.draftText,
    '承認': false,
    '送信済み': false,
    '送信日時': '',
    '登録日時': new Date(),
  });
}

/** 承認済み(承認=TRUE) かつ 未送信 の行を返す。送信処理の対象。 */
function getApprovedUnsentRows_() {
  const config = getConfig();
  const rows = readSheetAsObjects_(config.reviewSheetName);
  return rows.filter(r => r['承認'] === true && r['送信済み'] !== true);
}

function markRowSent_(rowIndex, note) {
  const config = getConfig();
  const sheet = getSheetByName_(config.reviewSheetName);
  updateRowByHeaders_(sheet, rowIndex, {
    '送信済み': true,
    '送信日時': new Date(),
    'ステータス': note || '送信済み',
  });
}
