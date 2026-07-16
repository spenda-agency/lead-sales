/**
 * スプレッドシートを開いた時にカスタムメニューを追加する。
 * インサイドセールス担当が、順番を意識して手動でも実行できるようにするため。
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('営業自動化')
    .addItem('① 新規リード取得＋下書き作成 (①→②→③)', 'runPipeline')
    .addItem('② ハウスリスト行動スコアリング実行', 'runScoringPipeline')
    .addItem('③ 承認済みリードを送信', 'sendApprovedLeads')
    .addSeparator()
    .addItem('定期実行トリガーを設定(30分おき)', 'setupTriggers')
    .addItem('定期実行トリガーを解除', 'removeTriggers')
    .addSeparator()
    .addItem('設定状況を確認(ログ)', 'checkConfig')
    .addToUi();
}
