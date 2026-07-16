/**
 * メインパイプライン: ①→②→③ の順に新規リードを取得し、
 * 重複していないものだけAI下書きを作成してレビューシートに登録する。
 * ここでは一切送信を行わない（送信は Send.gs の sendApprovedLeads を
 * 人が承認チェックを入れた後に実行する）。
 */
function runPipeline() {
  ensureReviewSheet_();

  const newLeadsBySource = {
    '①HP問い合わせ': processSourceLeads_(collectSource1Leads_()),
    '②LINE登録者': processSourceLeads_(collectSource2Leads_()),
    '③他社フォーム経由': processSourceLeads_(collectSource3Leads_()),
  };

  notifyNewLeads_(newLeadsBySource);

  const total = Object.values(newLeadsBySource).reduce((sum, leads) => sum + leads.length, 0);
  Logger.log('runPipeline完了: 新規%d件の下書きを作成しました', total);
  return newLeadsBySource;
}

/** 1つのソースの新規リード配列を受け取り、下書き生成→レビューシート登録まで行う */
function processSourceLeads_(leads) {
  leads.forEach(lead => {
    lead.draftText = generateDraftForLead_(lead);
    appendLeadToReviewSheet_(lead);
  });
  return leads;
}
