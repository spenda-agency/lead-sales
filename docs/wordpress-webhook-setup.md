# WordPressフォーム → スプレッドシート自動転記の設定手順

対象フォーム(19ページ):

```
/media/dl-contents-form-content01/ 〜 content12/   (資料DL 12種)
/media/form-freeconsulting/
/media/form-webmarketing/
/form-webadsplus/
/form-agency/
/form-aibidatasupport/
/form-lsmultibuilder/
/form-lookerstudio-dx/
```

転記先: スプレッドシート `1oELhU6ZZz2pjN_RylQ5NjidcS52nkbQa-4xqpOHm_K4` の「シート1」タブ
(列: timestamp / source / form_id / form_url / name / company / email / tel / kind / message / referrer / raw_json)

## 手順1: GAS側をデプロイする (先にこちら)

1. Apps Scriptエディタで「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
   - 実行するユーザー: **自分**
   - アクセスできるユーザー: **全員**
2. 発行されたURL `https://script.google.com/macros/s/XXXX/exec` を控える
3. Script Properties に `FORM_WEBHOOK_TOKEN` を設定する(長いランダム文字列。
   例: パスワード生成ツールで32文字程度)
4. Apps Scriptエディタで `testFormWebhook` を実行し、「シート1」に
   テスト行が1行入ることを確認する(確認後その行は削除してよい)

WordPress側から使うWebhook URLは次の形式:

```
https://script.google.com/macros/s/XXXX/exec?source=wpform&token=<FORM_WEBHOOK_TOKEN>
```

## 手順2: フォームプラグインを確認する

WordPress管理画面 → プラグイン → インストール済みプラグイン で、
フォームを提供しているプラグイン名を確認する(Contact Form 7 / WPForms /
Gravity Forms / MW WP Form など)。ページ編集画面のショートコード
(`[contact-form-7 ...]` 等)でも判別できる。

## 手順3-A: Contact Form 7 の場合

テーマの `functions.php`(子テーマ推奨)に以下を追加する。
これで**全CF7フォームの送信が自動でGASに転記される**(フォーム個別の設定は不要)。

```php
/**
 * Contact Form 7 送信内容をGAS経由でスプレッドシートに転記する。
 * 送信失敗してもフォーム利用者への影響はない(blocking => false)。
 */
add_action('wpcf7_mail_sent', function ($contact_form) {
    $webhook_url = 'https://script.google.com/macros/s/XXXX/exec?source=wpform&token=YYYY'; // ←差し替える

    $submission = WPCF7_Submission::get_instance();
    if (!$submission) {
        return;
    }

    $payload = $submission->get_posted_data();
    $payload['form_id']    = $contact_form->id();
    $payload['form_title'] = $contact_form->title();
    $payload['form_url']   = $submission->get_meta('url');
    $payload['referrer']   = isset($_SERVER['HTTP_REFERER']) ? esc_url_raw($_SERVER['HTTP_REFERER']) : '';
    $payload['site']       = home_url();

    wp_remote_post($webhook_url, array(
        'headers'  => array('Content-Type' => 'application/json'),
        'body'     => wp_json_encode($payload),
        'timeout'  => 5,
        'blocking' => false, // 応答を待たない(フォーム表示を遅くしない)
    ));
});
```

- `XXXX` は手順1のデプロイID、`YYYY` は `FORM_WEBHOOK_TOKEN` の値に差し替える
- フォームの項目名が `your-name` `your-email` 等(CF7標準)なら、GAS側で
  自動的に name/email 列にマッピングされる。独自の項目名を使っている場合は
  `src/FormWebhook.gs` の `FORM_FIELD_ALIASES` に項目名を追加する

### 反映方法(mixhost)

mixhostのcPanel → ファイルマネージャー、またはFTPで
`/wp-content/themes/<使用中のテーマ>/functions.php` を編集する。
WordPress管理画面の「外観 → テーマファイルエディター」からも編集できるが、
編集ミスでサイトが落ちるリスクがあるため、事前にファイルのバックアップを取ること。

## 手順3-B: その他のプラグインの場合

- **WPForms / Gravity Forms**: 有料版にWebhookアドオンがあり、送信先URLに
  上記Webhook URLを設定するだけでよい(形式はJSONを選択)
- **MW WP Form**: `mwform_after_send_...` フックで同様のPHPコードを書く
- プラグイン名が分かったら個別の設定内容を案内するので知らせてください

## 手順4: 動作確認

1. 本番フォームのどれか1つ(例: /media/form-freeconsulting/)からテスト送信する
2. 「シート1」に行が追加されることを確認する
   - form_id / form_url 列でどのフォームからの送信か判別できる
3. 入らない場合の切り分け:
   - GASの実行ログ(Apps Scriptエディタ →「実行数」)に doPost の記録があるか
   - 記録がない → WordPress側の送信が動いていない(functions.phpのURLとトークンを確認)
   - 記録がありエラー → ログのエラーメッセージを確認(タブ名・権限など)

## 補足: 既存パイプラインとの連携

この転記が動き出したら、「シート1」を既存の営業自動化パイプラインの
リード源(③他社フォーム経由と同様の扱い)として取り込み、新規行から
AI下書き→承認→送信のフローに乗せられる。その際は `SOURCE3_SHEET_NAME` を
このシートに向けるか、新しいSource4として追加する(要相談)。
