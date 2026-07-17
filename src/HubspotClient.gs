/**
 * HubSpot CRM API (v3) から、ハウスリストの行動データを取得する。
 * HUBSPOT_API_TOKEN が未設定の場合は空配列を返す（スコアリング機能自体が
 * 何もしないだけで、他の機能には影響しない）。
 *
 * 注意: hs_analytics_num_page_views はHubSpotの標準コンタクトプロパティで、
 * 自社サイトにHubSpotのトラッキングコードが入っていれば自動集計される。
 * 一方メール開封数はプランやワークフロー設定によって集計方法が異なるため、
 * HUBSPOT_EMAIL_OPEN_PROPERTY で実際のプロパティ名に合わせること。
 * 存在しないプロパティ名を指定した場合、値は0として扱われる。
 */
function fetchHouseListContacts_() {
  const config = getConfig();
  if (!config.hubspotApiToken) {
    Logger.log('HUBSPOT_API_TOKEN未設定のため、ハウスリストの行動スコアリングをスキップします');
    return [];
  }

  const properties = [
    'email', 'firstname', 'lastname', 'company', 'jobtitle',
    config.hubspotPageViewsProperty, config.hubspotEmailOpenProperty,
  ];

  const rawContacts = config.hubspotHouseListId
    ? fetchContactsInList_(config.hubspotHouseListId, properties, config.hubspotMaxContacts)
    : fetchAllContacts_(properties, config.hubspotMaxContacts);

  return rawContacts.map(c => normalizeHubspotContact_(c, config));
}

function normalizeHubspotContact_(contact, config) {
  const props = contact.properties || {};
  return {
    id: contact.id,
    email: props.email || '',
    contactName: [props.lastname, props.firstname].filter(Boolean).join(' '),
    company: props.company || '',
    jobtitle: props.jobtitle || '',
    pageViews: Number(props[config.hubspotPageViewsProperty] || 0),
    emailOpenValue: parseEmailOpenValue_(
      props[config.hubspotEmailOpenProperty], config.hubspotEmailOpenPropertyType
    ),
  };
}

/**
 * 'count' なら累積開封数(数値)として、'date' なら「直近の開封日時」を
 * 比較しやすいエポックミリ秒に変換して返す。値が無ければ0。
 */
function parseEmailOpenValue_(rawValue, type) {
  if (!rawValue) return 0;
  if (type === 'count') return Number(rawValue) || 0;
  const timestamp = new Date(rawValue).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function fetchAllContacts_(properties, maxContacts) {
  const config = getConfig();
  const results = [];
  let after = null;

  do {
    const url = buildUrl_('https://api.hubapi.com/crm/v3/objects/contacts', {
      limit: 100,
      properties: properties.join(','),
      after: after,
    });
    const json = hubspotFetch_(url, config.hubspotApiToken);
    if (!json) break;

    results.push(...(json.results || []));
    after = json.paging && json.paging.next ? json.paging.next.after : null;
  } while (after && results.length < maxContacts);

  return results.slice(0, maxContacts);
}

function fetchContactsInList_(listId, properties, maxContacts) {
  const config = getConfig();
  const contactIds = [];
  let after = null;

  do {
    const url = buildUrl_(`https://api.hubapi.com/crm/v3/lists/${listId}/memberships/join-order`, {
      limit: 100,
      after: after,
    });
    const json = hubspotFetch_(url, config.hubspotApiToken);
    if (!json) break;

    (json.results || []).forEach(r => contactIds.push(r.recordId));
    after = json.paging && json.paging.next ? json.paging.next.after : null;
  } while (after && contactIds.length < maxContacts);

  return batchReadContacts_(contactIds.slice(0, maxContacts), properties);
}

function batchReadContacts_(contactIds, properties) {
  if (contactIds.length === 0) return [];
  const config = getConfig();
  const results = [];

  // batch/read は一度に最大100件まで
  for (let i = 0; i < contactIds.length; i += 100) {
    const chunk = contactIds.slice(i, i + 100);
    const response = UrlFetchApp.fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: `Bearer ${config.hubspotApiToken}` },
      payload: JSON.stringify({ properties, inputs: chunk.map(id => ({ id })) }),
      muteHttpExceptions: true,
    });
    if (response.getResponseCode() !== 200) {
      Logger.log('HubSpot batch/read エラー: %s', response.getContentText());
      continue;
    }
    results.push(...(JSON.parse(response.getContentText()).results || []));
  }
  return results;
}

function hubspotFetch_(url, apiToken) {
  const response = UrlFetchApp.fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) {
    Logger.log('HubSpot APIエラー(%s): %s', response.getResponseCode(), response.getContentText());
    return null;
  }
  return JSON.parse(response.getContentText());
}

function buildUrl_(base, params) {
  const query = Object.keys(params)
    .filter(k => params[k] !== null && params[k] !== undefined && params[k] !== '')
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
  return query ? `${base}?${query}` : base;
}
