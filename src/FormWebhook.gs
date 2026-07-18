/**
 * WordPressの問い合わせフォームからのWebhook受信。
 * 自社サイト(/media/配下のWordPress)の各フォームが送信されたら、
 * その内容を指定のスプレッドシート(FORM_SHEET_ID)の「シート1」タブに
 * 1行転記する。転記先の列構成は既存タブに合わせて固定:
 *   timestamp | source | form_id | form_url | name | company | email | tel |
 *   kind | message | referrer | raw_json
 *
 * 受信形式は次のどちらにも対応する:
 * - application/json (推奨。functions.phpのフックやWebhook系プラグイン)
 * - application/x-www-form-urlencoded (フォームPOSTそのまま)
 *
 * 認証: URLに ?token=<FORM_WEBHOOK_TOKEN> を付ける。Script Propertiesの
 * FORM_WEBHOOK_TOKEN と一致しないリクエストは転記せず捨てる
 * (トークン未設定の間は検証をスキップする)。
 */
const FORM_SHEET_COLUMNS = [
  'timestamp', 'source', 'form_id', 'form_url', 'name', 'company',
  'email', 'tel', 'kind', 'message', 'referrer', 'raw_json',
];

/** フォーム項目名の表記ゆれを列名に寄せるためのエイリアス */
const FORM_FIELD_ALIASES = {
  name: ['name', 'your-name', 'お名前', '氏名', 'fullname'],
  company: ['company', 'your-company', '会社名', '御社名', '貴社名', 'company-name'],
  email: ['email', 'your-email', 'メールアドレス', 'mail'],
  tel: ['tel', 'your-tel', 'phone', '電話番号', 'your-phone'],
  kind: ['kind', 'your-kind', '種別', 'お問い合わせ種別', 'category', 'subject', 'your-subject'],
  message: ['message', 'your-message', 'お問い合わせ内容', '内容', 'inquiry', 'comment'],
};

function handleWpFormPost_(e) {
  const config = getConfig();

  if (config.formWebhookToken) {
    const token = (e.parameter && e.parameter.token) || '';
    if (token !== config.formWebhookToken) {
      Logger.log('フォームWebhook: トークン不一致のため破棄');
      return ContentService.createTextOutput('unauthorized');
    }
  }

  const fields = parseFormPayload_(e);
  appendFormRowToSheet_(fields);
  return ContentService.createTextOutput('ok');
}

/** JSONボディ/フォームエンコードのどちらでも同じオブジェクトに正規化する */
function parseFormPayload_(e) {
  let raw = {};
  const contents = e.postData ? e.postData.contents : '';
  const contentType = e.postData ? String(e.postData.type || '') : '';

  if (contentType.indexOf('application/json') !== -1) {
    raw = JSON.parse(contents);
  } else {
    // form-urlencoded はGASが e.parameter に展開してくれる
    raw = Object.assign({}, e.parameter);
    delete raw.source;
    delete raw.token;
  }

  const pick = key => {
    for (const alias of FORM_FIELD_ALIASES[key]) {
      if (raw[alias] !== undefined && raw[alias] !== '') return String(raw[alias]);
    }
    return '';
  };

  return {
    timestamp: new Date(),
    source: String(raw.source_label || raw.site || 'wordpress'),
    form_id: String(raw.form_id || raw._wpcf7 || raw.form_title || ''),
    form_url: String(raw.form_url || raw.page_url || raw.url || ''),
    name: pick('name'),
    company: pick('company'),
    email: pick('email'),
    tel: pick('tel'),
    kind: pick('kind'),
    message: pick('message'),
    referrer: String(raw.referrer || raw.http_referer || ''),
    raw_json: JSON.stringify(raw),
  };
}

function appendFormRowToSheet_(fields) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.formSheetId);
  const sheet = ss.getSheetByName(config.formSheetTabName);
  if (!sheet) {
    throw new Error(`転記先タブ「${config.formSheetTabName}」が見つかりません`);
  }
  sheet.appendRow(FORM_SHEET_COLUMNS.map(col => fields[col]));
}

/**
 * 手動テスト用: Apps Scriptエディタから実行すると、ダミーの問い合わせが
 * 1行転記される。WordPress側の設定前に転記先の動作確認ができる。
 */
function testFormWebhook() {
  appendFormRowToSheet_({
    timestamp: new Date(),
    source: 'テスト実行',
    form_id: 'form-freeconsulting',
    form_url: 'https://example.com/media/form-freeconsulting/',
    name: 'テスト太郎',
    company: 'テスト株式会社',
    email: 'test@example.com',
    tel: '03-0000-0000',
    kind: '無料相談',
    message: 'これはtestFormWebhook()による動作確認です。削除してください。',
    referrer: 'https://example.com/media/',
    raw_json: '{"test":true}',
  });
  Logger.log('テスト行を転記しました。スプレッドシートを確認してください。');
}
