/**
 * Webhook受信の一本化。
 * GASプロジェクトには doPost を1つしか定義できないため、
 * URLの ?source= パラメータで受信元を振り分ける。
 *
 *   .../exec?source=line    → LINE公式アカウント(友だち追加イベント)
 *   .../exec?source=wpform  → WordPressの問い合わせフォーム
 *
 * デプロイ手順:
 * 1. Apps Scriptエディタ >「デプロイ」>「新しいデプロイ」> 種類「ウェブアプリ」
 *    - 実行するユーザー: 自分 / アクセスできるユーザー: 全員
 * 2. 発行されたURL(https://script.google.com/macros/s/.../exec)に、
 *    用途ごとのクエリパラメータを付けて各サービスに設定する
 *    - LINE Developers Webhook URL:  <URL>?source=line
 *    - WordPress Webhook送信先:      <URL>?source=wpform&token=<FORM_WEBHOOK_TOKEN>
 */
function doPost(e) {
  try {
    const source = (e && e.parameter && e.parameter.source) || '';

    if (source === 'wpform') {
      return handleWpFormPost_(e);
    }
    // 既存のLINE連携は source=line だが、パラメータ無しの既存デプロイ設定でも
    // 壊れないよう、既定はLINEハンドラに流す
    return handleLinePost_(e);
  } catch (err) {
    Logger.log('doPost error: %s', err);
    return ContentService.createTextOutput('error');
  }
}
