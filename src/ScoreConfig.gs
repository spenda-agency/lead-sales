/**
 * 「スコア設定」シート: 配点・閾値を運用チームがコードを触らずに調整できるようにする。
 * 社内マニュアルの注意点「配点・閾値は固定ではなく、反応率を見ながら調整すること」
 * に対応するため、Script Propertiesではなくスプレッドシート上の値にしている。
 */
const SCORE_CONFIG_HEADERS = ['項目', '値'];
const SCORE_CONFIG_DEFAULTS = [
  ['サイト訪問1回あたりの配点', 2],
  ['メール開封1回あたりの配点', 1],
  ['通知閾値', 5],
];

function ensureScoreConfigSheet_() {
  const config = getConfig();
  const sheet = ensureSheetWithHeaders_(config.scoreConfigSheetName, SCORE_CONFIG_HEADERS);
  if (sheet.getLastRow() < 2) {
    SCORE_CONFIG_DEFAULTS.forEach(row => sheet.appendRow(row));
  }
  return sheet;
}

function getScoringConfig_() {
  ensureScoreConfigSheet_();
  const config = getConfig();
  const rows = readSheetAsObjects_(config.scoreConfigSheetName);
  const findValue = (label, fallback) => {
    const row = rows.find(r => String(r['項目']).trim() === label);
    const value = row ? Number(row['値']) : NaN;
    return Number.isFinite(value) ? value : fallback;
  };

  return {
    pointsPerVisit: findValue('サイト訪問1回あたりの配点', 2),
    pointsPerOpen: findValue('メール開封1回あたりの配点', 1),
    threshold: findValue('通知閾値', 5),
  };
}
