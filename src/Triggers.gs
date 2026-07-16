/**
 * 定期実行トリガーの設定/解除。
 * runPipeline: 新規リード取得→下書き作成のみ(送信はしない)
 * sendApprovedLeads: 承認済みの送信
 */
function setupTriggers() {
  removeTriggers();
  ScriptApp.newTrigger('runPipeline').timeBased().everyMinutes(30).create();
  ScriptApp.newTrigger('sendApprovedLeads').timeBased().everyMinutes(30).create();
  Logger.log('トリガーを設定しました(30分おき)');
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (['runPipeline', 'sendApprovedLeads'].includes(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}
