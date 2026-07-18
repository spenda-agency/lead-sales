/**
 * 設定の一元管理。
 * 秘密情報（APIキー等）はコードに書かず、必ず Script Properties
 * （Apps Script エディタ > プロジェクトの設定 > スクリプト プロパティ）に設定する。
 * DRY_RUN が true の間は、メール送信・LINE送信・Slack通知は
 * 実際には行わず Logger にだけ出力する（キー未設定でも安全に試せる）。
 */
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  const get = (key, defaultValue) => props.getProperty(key) || defaultValue;

  return {
    // 未設定時は安全側に倒して true（DRY_RUN）とする
    dryRun: get('DRY_RUN', 'true') !== 'false',

    // --- AI下書き生成 ---
    anthropicApiKey: get('ANTHROPIC_API_KEY', ''),
    anthropicModel: get('ANTHROPIC_MODEL', 'claude-sonnet-5'),

    // --- LINE公式アカウント（Messaging API） ---
    lineChannelAccessToken: get('LINE_CHANNEL_ACCESS_TOKEN', ''),

    // --- Slack通知（任意） ---
    slackWebhookUrl: get('SLACK_WEBHOOK_URL', ''),

    // --- HubSpot（工程①ハウスリスト行動スコアリングで使用） ---
    hubspotApiToken: get('HUBSPOT_API_TOKEN', ''),
    // 静的リストIDを指定すると、そのリストの会員だけをスコアリング対象にする。
    // 未設定の場合は全コンタクトを対象にする(HUBSPOT_MAX_CONTACTSで件数上限)。
    hubspotHouseListId: get('HUBSPOT_HOUSE_LIST_ID', ''),
    hubspotMaxContacts: Number(get('HUBSPOT_MAX_CONTACTS', '500')),
    // サイト訪問数を表すHubSpotコンタクトプロパティ名(累積カウント)。
    // アカウントのプランやカスタムプロパティ設定によって名前が異なる場合は変更する。
    hubspotPageViewsProperty: get('HUBSPOT_PAGEVIEWS_PROPERTY', 'hs_analytics_num_page_views'),
    // メール開封の signal。既定値はSales Hubの「直近のセールスメール開封日時」。
    // hs_email_open(マーケティングメール開封数の累積カウント)はMarketing Hub専用のため、
    // Marketing Hubを契約していない場合は既定値のままでよい。
    hubspotEmailOpenProperty: get('HUBSPOT_EMAIL_OPEN_PROPERTY', 'hs_sales_email_last_opened'),
    // 'count'(累積カウントの差分で加点) or 'date'(基準日時より新しい開封が1件でもあれば加点)
    hubspotEmailOpenPropertyType: get('HUBSPOT_EMAIL_OPEN_PROPERTY_TYPE', 'date'),

    // --- WordPressフォーム転記先 ---
    // 転記先スプレッドシートのID(URLの /d/ と /edit の間の文字列)
    formSheetId: get('FORM_SHEET_ID', '1oELhU6ZZz2pjN_RylQ5NjidcS52nkbQa-4xqpOHm_K4'),
    formSheetTabName: get('FORM_SHEET_TAB_NAME', 'シート1'),
    // WordPress側からのWebhookに付ける合言葉。推測されない文字列を設定すること
    formWebhookToken: get('FORM_WEBHOOK_TOKEN', ''),

    // --- スプレッドシートのタブ名 ---
    reviewSheetName: get('REVIEW_SHEET_NAME', 'リード確認'),
    source1SheetName: get('SOURCE1_SHEET_NAME', '①HP問い合わせ'),
    source2SheetName: get('SOURCE2_SHEET_NAME', '②LINE登録者'),
    source3SheetName: get('SOURCE3_SHEET_NAME', '③他社フォーム経由'),
    scoreSheetName: get('SCORE_SHEET_NAME', 'ハウスリストスコア'),
    scoreConfigSheetName: get('SCORE_CONFIG_SHEET_NAME', 'スコア設定'),

    // --- 送信者情報 ---
    companyName: get('COMPANY_NAME', '自社'),
    senderName: get('SENDER_NAME', '営業担当'),
    senderEmail: get('SENDER_EMAIL', ''),

    // --- 送信モード: 'send'（即送信） or 'draft'（Gmail下書きに保存して人が最終送信） ---
    emailSendMode: get('EMAIL_SEND_MODE', 'draft'),
  };
}

/**
 * 初回セットアップ用: 必須/任意のScript Propertiesを一覧で確認できるようにする。
 * 実行すると Logger に現在の設定状況（値そのものではなく設定有無）を出す。
 */
function checkConfig() {
  const config = getConfig();
  Logger.log('DRY_RUN: %s', config.dryRun);
  Logger.log('ANTHROPIC_API_KEY 設定済み: %s', !!config.anthropicApiKey);
  Logger.log('LINE_CHANNEL_ACCESS_TOKEN 設定済み: %s', !!config.lineChannelAccessToken);
  Logger.log('SLACK_WEBHOOK_URL 設定済み: %s', !!config.slackWebhookUrl);
  Logger.log('HUBSPOT_API_TOKEN 設定済み: %s', !!config.hubspotApiToken);
  Logger.log('HUBSPOT_HOUSE_LIST_ID: %s', config.hubspotHouseListId || '(未設定・全コンタクト対象)');
  Logger.log('FORM_SHEET_ID: %s', config.formSheetId);
  Logger.log('FORM_WEBHOOK_TOKEN 設定済み: %s', !!config.formWebhookToken);
  Logger.log('SENDER_EMAIL: %s', config.senderEmail || '(未設定)');
  Logger.log('EMAIL_SEND_MODE: %s', config.emailSendMode);
}
