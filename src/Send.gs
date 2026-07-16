/**
 * レビューシートで「承認」にチェックが入った行だけを送信する。
 * ①③(メールアドレスあり)はGmail、②(LINEユーザーIDあり)はLINE Messaging APIで送る。
 * DRY_RUN=true の間は実際には送信せず、ログに出すだけ。
 */
function sendApprovedLeads() {
  const rows = getApprovedUnsentRows_();
  let sentCount = 0;

  rows.forEach(row => {
    try {
      if (row['LINEユーザーID']) {
        sendLineMessage_(row['LINEユーザーID'], row['AI下書き']);
      } else if (row['メールアドレス']) {
        sendEmailDraft_(row['メールアドレス'], row['AI下書き']);
      } else {
        Logger.log('送信先不明のためスキップ(行%s)', row.rowIndex_);
        return;
      }
      markRowSent_(row.rowIndex_, '送信済み');
      sentCount++;
    } catch (err) {
      Logger.log('送信失敗(行%s): %s', row.rowIndex_, err);
    }
  });

  Logger.log('sendApprovedLeads完了: %d件送信', sentCount);
  return sentCount;
}

/** AI下書きの1行目が「件名: ...」ならそれを件名として使い、残りを本文にする */
function splitSubjectAndBody_(draftText) {
  const lines = String(draftText).split('\n');
  if (lines[0] && lines[0].indexOf('件名:') === 0) {
    return {
      subject: lines[0].replace('件名:', '').trim(),
      body: lines.slice(1).join('\n').trim(),
    };
  }
  return { subject: 'ご連絡', body: draftText };
}

function sendEmailDraft_(email, draftText) {
  const config = getConfig();
  const { subject, body } = splitSubjectAndBody_(draftText);

  if (config.dryRun) {
    Logger.log('[DRY_RUN] メール送信スキップ: to=%s subject=%s', email, subject);
    return;
  }

  if (config.emailSendMode === 'draft') {
    GmailApp.createDraft(email, subject, body);
  } else {
    GmailApp.sendEmail(email, subject, body);
  }
}

function sendLineMessage_(userId, messageText) {
  const config = getConfig();
  if (config.dryRun) {
    Logger.log('[DRY_RUN] LINE送信スキップ: to=%s', userId);
    return;
  }
  if (!config.lineChannelAccessToken) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN が未設定です');
  }

  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${config.lineChannelAccessToken}` },
    payload: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text: messageText }],
    }),
    muteHttpExceptions: true,
  });
}
