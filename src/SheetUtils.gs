/**
 * スプレッドシート操作の共通ヘルパー。
 * 各リストの列名は会社によって表記ゆれがあるため、ヘッダー行の文字列で
 * 列を探す方式にしている（列の順番が変わっても壊れにくい）。
 */

function getActiveSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheetByName_(sheetName) {
  return getActiveSpreadsheet_().getSheetByName(sheetName);
}

/**
 * 指定シートの全行を、ヘッダー行をキーにしたオブジェクトの配列として返す。
 * シートが存在しない場合は空配列を返す（存在しないリストは単にスキップする）。
 * 戻り値の各要素には rowIndex_（シート上の実際の行番号）も含める。
 */
function readSheetAsObjects_(sheetName) {
  const sheet = getSheetByName_(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = { rowIndex_: i + 1 };
    headers.forEach((header, colIdx) => {
      if (header) obj[header] = row[colIdx];
    });
    rows.push(obj);
  }
  return rows;
}

/** ヘッダー候補の中から、実際にシートに存在する値を最初に見つけたものを返す */
function firstNonEmpty_(obj, headerCandidates) {
  for (const h of headerCandidates) {
    if (obj[h] !== undefined && obj[h] !== '' && obj[h] !== null) return obj[h];
  }
  return '';
}

/** シートが無ければヘッダー付きで新規作成し、Sheetオブジェクトを返す */
function ensureSheetWithHeaders_(sheetName, headers) {
  const ss = getActiveSpreadsheet_();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendRowByHeaders_(sheet, headers, rowObj) {
  const row = headers.map(h => (rowObj[h] !== undefined ? rowObj[h] : ''));
  sheet.appendRow(row);
}

/** 既存行の特定列だけを、ヘッダー名指定で更新する(列の並びが変わっても安全) */
function updateRowByHeaders_(sheet, rowIndex, fieldsObj) {
  const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Object.keys(fieldsObj).forEach(key => {
    const col = headerRow.indexOf(key) + 1;
    if (col > 0) sheet.getRange(rowIndex, col).setValue(fieldsObj[key]);
  });
}
