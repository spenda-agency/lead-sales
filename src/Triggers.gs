/**
 * 定期実行トリガーの設定/解除。
 * runPipeline: 新規リード取得→下書き作成のみ(送信はしない)
 * runScoringPipeline: ハウスリストの行動スコアリング→閾値超過分の下書き作成
 * sendApprovedLeads: 承認済みの送信
 */
const TRIGGERED_FUNCTIONS = ['runPipeline', 'runScoringPipeline', 'sendApprovedLeads'];

function setupTriggers() {
  removeTriggers();
  ScriptApp.newTrigger('runPipeline').timeBased().everyMinutes(30).create();
  ScriptApp.newTrigger('runScoringPipeline').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('sendApprovedLeads').timeBased().everyMinutes(30).create();
  Logger.log('トリガーを設定しました(新規リード/送信:30分おき、行動スコアリング:1時間おき)');
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (TRIGGERED_FUNCTIONS.includes(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}
