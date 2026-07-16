/**
 * Claude API (Anthropic Messages API) 呼び出しの薄いラッパー。
 * ANTHROPIC_API_KEY が未設定の場合は null を返す
 * （呼び出し側でテンプレート下書きにフォールバックする）。
 */
function callClaude_(userPrompt) {
  const config = getConfig();
  if (!config.anthropicApiKey) return null;

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  if (code !== 200) {
    Logger.log('Claude API error (%s): %s', code, response.getContentText());
    return null;
  }

  const json = JSON.parse(response.getContentText());
  return (json.content || []).map(block => block.text || '').join('\n').trim();
}
