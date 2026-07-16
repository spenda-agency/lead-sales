/**
 * LINE公式アカウントのWebhook受信エントリポイント。
 * 「友だち追加(follow)」イベントを受け取ったら、プロフィールを取得して
 * ②LINE登録者シートに1行追記する。それ以外のイベント種別は無視する。
 *
 * 注意: Apps ScriptのdoPost(e)はHTTPリクエストヘッダーを受け取れないため、
 * LINEが x-line-signature ヘッダーで送ってくる署名の検証はここでは行えない
 * （ヘッダーにアクセスする手段がApps Script側に無い）。そのため本Webhook URLは
 * 推測されにくいデプロイURLであること自体を防御としつつ、実イベントかどうかは
 * event.source.userId の有無など内容ベースで最低限の妥当性チェックのみ行う。
 * より厳密な検証が必要な場合は、LINE向けにCloud Run/Functions等
 * ヘッダーを扱える実行環境を別途用意することを検討する。
 *
 * 設定手順:
 * 1. このプロジェクトを「ウェブアプリとしてデプロイ」し、発行されたURLを
 *    LINE Developers コンソールの Messaging API > Webhook URL に設定する
 * 2. Script Properties に LINE_CHANNEL_ACCESS_TOKEN を設定する
 */
const SOURCE2_SHEET_HEADERS = ['登録日時', '表示名', 'LINEユーザーID', 'メモ'];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    (body.events || []).forEach(handleLineEvent_);
  } catch (err) {
    Logger.log('doPost error: %s', err);
  }
  return ContentService.createTextOutput('ok');
}

function handleLineEvent_(event) {
  if (event.type !== 'follow') return; // 友だち追加以外は今回のスコープ外

  const userId = event.source && event.source.userId;
  if (!userId) return;

  const profile = fetchLineProfile_(userId);
  const sheet = ensureSheetWithHeaders_(getConfig().source2SheetName, SOURCE2_SHEET_HEADERS);
  appendRowByHeaders_(sheet, SOURCE2_SHEET_HEADERS, {
    '登録日時': new Date(),
    '表示名': (profile && profile.displayName) || '',
    'LINEユーザーID': userId,
    'メモ': 'Webhook経由で自動登録',
  });
}

function fetchLineProfile_(userId) {
  const config = getConfig();
  if (!config.lineChannelAccessToken) return null;

  const response = UrlFetchApp.fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${config.lineChannelAccessToken}` },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) {
    Logger.log('LINE profile取得失敗: %s', response.getContentText());
    return null;
  }
  return JSON.parse(response.getContentText());
}
