/**
 * 新規下書きが出来た際の社内通知（Slack）。
 * SLACK_WEBHOOK_URL 未設定、または DRY_RUN=true の場合はログ出力のみ。
 */
function notifySlack_(message) {
  const config = getConfig();
  if (config.dryRun || !config.slackWebhookUrl) {
    Logger.log('[DRY_RUN/未設定のためSlack通知はスキップ] %s', message);
    return;
  }

  UrlFetchApp.fetch(config.slackWebhookUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ text: message }),
    muteHttpExceptions: true,
  });
}

function notifyNewLeads_(newLeadsBySource) {
  const lines = [];
  Object.keys(newLeadsBySource).forEach(sourceLabel => {
    const leads = newLeadsBySource[sourceLabel];
    if (leads.length > 0) {
      lines.push(`${sourceLabel}: 新規${leads.length}件の下書きを作成しました`);
    }
  });
  if (lines.length === 0) return;

  notifySlack_(['【リード確認】新しい下書きができました。内容を確認・承認してください。', ...lines].join('\n'));
}
