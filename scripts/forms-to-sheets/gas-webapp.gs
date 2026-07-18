/**
 * SPENDA Web フォーム → Google Sheets ロガー
 * ----------------------------------------------
 * Apps Script Web App として「拡張機能 → Apps Script」で作成し、
 * 「デプロイ → 新しいデプロイ → 種類: ウェブアプリ → 次のユーザーとして実行: 自分 /
 *  アクセスできるユーザー: 全員」で公開して URL を取得する。
 *
 * 受信 JSON フォーマット:
 *   {
 *     "source":   "wp-mwform" | "php-mail",
 *     "form_id":  "5688" | "contact-html" | ...,
 *     "form_url": "https://spendacorp.com/media/form-freeconsulting/",
 *     "fields": {
 *       "user_name":   "...",   // または name / お名前
 *       "company_name":"...",   // または company / 会社名
 *       "email":       "...",
 *       "tel":         "...",
 *       "kind":        "...",   // contact.html のみ
 *       "message":     "..."    // または contents / お問い合わせ内容
 *     },
 *     "raw":      { ...全 POST データ... },
 *     "referrer": "...",
 *     "secret":   "FORM_SHARED_SECRET"
 *   }
 *
 * 出力先 Sheet:
 *   既定では「アクティブな Spreadsheet」(=コンテナ束縛時のシート) の "シート1" タブ。
 *   スタンドアロン作成時は Script Properties に SHEET_ID をセットして openById する。
 *
 * Script Properties (拡張機能 → Apps Script → プロジェクトの設定 → スクリプト プロパティ):
 *   - FORM_SHARED_SECRET (必須)  : WP/mail.php からの正規送信判定用シークレット
 *   - SHEET_ID           (任意)  : スタンドアロン Apps Script の場合に対象 Sheet ID
 *   - SHEET_TAB          (任意)  : 書き込み先タブ名(デフォルト "シート1")
 *
 * デプロイ後の動作確認:
 *   curl -L -X POST -H "Content-Type: application/json" \
 *        -d '{"source":"test","secret":"<上で設定したシークレット>","fields":{"name":"テスト","email":"t@x.com","message":"hello"}}' \
 *        "<デプロイ URL>"
 */

const DEFAULT_TAB = 'シート1';

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getTabName_() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_TAB') || DEFAULT_TAB;
}

function getSharedSecret_() {
  return PropertiesService.getScriptProperties().getProperty('FORM_SHARED_SECRET') || '';
}

/** 最初に該当する非空値を返す(エイリアス対応用)。 */
function firstFilled_(obj, keys) {
  if (!obj) return '';
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return Array.isArray(v) ? v.join(', ') : String(v);
    }
  }
  return '';
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_({ ok: false, error: 'empty body' });
    }
    const body = JSON.parse(e.postData.contents);

    // 共有シークレット検証(fail-closed: 未設定なら全リクエスト拒否)
    const expected = getSharedSecret_();
    if (!expected) {
      return jsonResponse_({ ok: false, error: 'server misconfigured: FORM_SHARED_SECRET not set' });
    }
    if (body.secret !== expected) {
      return jsonResponse_({ ok: false, error: 'unauthorized' });
    }

    const fields = body.fields || {};
    const row = [
      new Date(),                              // A: timestamp
      String(body.source || ''),               // B: source
      String(body.form_id || ''),              // C: form_id
      String(body.form_url || ''),             // D: form_url
      firstFilled_(fields, ['name', 'user_name', 'お名前']),
      firstFilled_(fields, ['company', 'company_name', '会社名']),
      firstFilled_(fields, ['email', 'Email', 'mail']),
      firstFilled_(fields, ['tel', 'phone', '電話番号']),
      firstFilled_(fields, ['kind', 'お問合せ種別', 'subject']),
      firstFilled_(fields, ['message', 'contents', 'お問い合わせ内容', 'inquiry']),
      String(body.referrer || ''),             // K: referrer
      JSON.stringify(body.raw || body.fields || {})  // L: raw_json
    ];

    const ss = getSpreadsheet_();
    const tab = getTabName_();
    const sheet = ss.getSheetByName(tab);
    if (!sheet) {
      return jsonResponse_({ ok: false, error: 'sheet tab not found: ' + tab });
    }
    sheet.appendRow(row);
    return jsonResponse_({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    Logger.log('doPost error: ' + err.stack);
    return jsonResponse_({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return ContentService
    .createTextOutput('OK - SPENDA forms-to-sheets endpoint. POST JSON to log a row.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 手動テスト用: Apps Script エディタで「testInsert」を選んで実行 → 1 行追加される
 */
function testInsert() {
  doPost({
    postData: {
      contents: JSON.stringify({
        source: 'manual-test',
        form_id: 'gas-test',
        form_url: 'https://script.google.com/',
        secret: getSharedSecret_(),
        fields: {
          name: 'テスト太郎',
          company: 'テスト株式会社',
          email: 'test@example.com',
          tel: '090-0000-0000',
          kind: 'gas-test',
          message: 'GAS から直接テスト送信',
        },
        raw: { test: true },
        referrer: '',
      }),
    },
  });
}
