<?php
/**
 * Plugin Name: SPENDA Forms-to-Sheets bridge
 * Description: MW WP Form の正常送信完了時に GAS Web App へ POST して Google Sheets に記録
 * Version:     1.2.0
 * Author:      SPENDA / lead-sales
 *
 * 設置先:
 *   wp-content/mu-plugins/spenda-forms-to-sheets.php
 *   ※ mu-plugins 配下は自動有効化(WordPress 管理画面での有効化不要)
 *   ※ 更新が反映されたかは、管理画面 > プラグイン > 必須 タブの
 *     「バージョン」表示で確認できる(このファイルは 1.2.0)
 *
 * 設定:
 *   wp-config.php に下記 2 行を追加(repo にはコミットしない):
 *     define('SPENDA_GAS_URL',    'https://script.google.com/macros/s/AKfy.../exec');
 *     define('SPENDA_FORM_SECRET','GAS の Script Properties と同じシークレット文字列');
 *
 *   デバッグしたい場合はさらに下記を追加すると、送信のたびに
 *   wp-content/uploads/spenda-forms-to-sheets.log に記録される(解決後は削除):
 *     define('SPENDA_FORMS_DEBUG', true);
 *
 * 対象フォーム:
 *   spendacorp.com/media/* 配下の MW WP Form 全フォーム(20+ 個)
 *   フォーム ID 別の特殊処理が必要になったら $form_id を分岐させて拡張する。
 *
 * 安全策:
 *   - 送信は直接 cURL(タイムアウト5s)。wp_remote_post は本ホスティング環境で
 *     リクエスト本文が GAS に届かない事象(空ボディ)を確認したため使わない。
 *     cURL が無い環境でのみ wp_remote_post にフォールバックする
 *   - SSL証明書検証あり / 送信失敗してもフォーム処理自体には影響しない
 *   - 内部用フィールド(mw_ 系 / recaptcha / wp_nonce / _wp 系)はマスク
 *   - メール送信が成功した時点でフックされる(`mwform_after_send`)→ reCAPTCHA で
 *     弾かれた送信は記録されない(ノイズ防止)
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('mwform_after_send', 'spenda_forms_after_send', 10, 1);

function spenda_forms_after_send($Data) {
    if (!defined('SPENDA_GAS_URL') || !SPENDA_GAS_URL) {
        return; // 未設定なら何もしない
    }

    // $Data は MW_WP_Form_Data インスタンス
    $form_id = '';
    $values  = [];
    if (is_object($Data)) {
        if (method_exists($Data, 'get_form_key')) {
            $form_id = (string) $Data->get_form_key();
        }
        if (method_exists($Data, 'gets')) {
            $values = (array) $Data->gets();
        }
    }
    // フォールバック: $_POST から拾う(プラグインバージョン差異対策)
    if (empty($values) && !empty($_POST)) {
        $values = wp_unslash($_POST);
    }

    // 内部用フィールドは除外(送信内容ではない)
    $clean = [];
    foreach ($values as $k => $v) {
        if (preg_match('/^(mw_wp_form|mw-wp-form|recaptcha|wp_nonce|_wp|_wpnonce)/i', $k)) {
            continue;
        }
        if (is_array($v)) {
            $v = implode(', ', array_map('strval', $v));
        }
        $clean[(string) $k] = (string) $v;
    }

    $form_url = isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : home_url($_SERVER['REQUEST_URI'] ?? '');

    $payload = [
        'source'   => 'wp-mwform',
        'form_id'  => $form_id,
        'form_url' => $form_url,
        'fields'   => [
            'user_name'    => $clean['user_name']    ?? ($clean['name']    ?? ''),
            'company_name' => $clean['company_name'] ?? ($clean['company'] ?? ''),
            'email'        => $clean['email']        ?? '',
            'tel'          => $clean['tel']          ?? ($clean['phone'] ?? ''),
            'kind'         => $clean['kind']         ?? '',
            'message'      => $clean['contents']     ?? ($clean['message'] ?? ''),
        ],
        'raw'      => $clean,
        'referrer' => $_SERVER['HTTP_REFERER'] ?? '',
        'secret'   => defined('SPENDA_FORM_SECRET') ? SPENDA_FORM_SECRET : '',
    ];

    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($json === false) {
        spenda_forms_debug_log_('json_encode失敗: ' . json_last_error_msg());
        return;
    }

    // wp_remote_post は本環境で本文が届かない事象があったため、直接 cURL で送る
    if (function_exists('curl_init')) {
        $ch = curl_init(SPENDA_GAS_URL);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $json,
            // 'Expect:' 空指定で 100-continue ハンドシェイクを無効化
            // (途中経路によっては本文が送信されない原因になるため)
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Expect:'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 5,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $resp = curl_exec($ch);
        $err  = curl_error($ch);
        $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        spenda_forms_debug_log_(sprintf(
            'curl送信 form_id=%s json=%dバイト http=%s resp=%s err=%s',
            $form_id, strlen($json), $code,
            substr((string) $resp, 0, 200), $err ?: '(なし)'
        ));
    } else {
        $response = wp_remote_post(SPENDA_GAS_URL, [
            'method'    => 'POST',
            'headers'   => ['Content-Type' => 'application/json'],
            'body'      => $json,
            'timeout'   => 5,
            'blocking'  => true,
            'sslverify' => true,
        ]);
        spenda_forms_debug_log_(sprintf(
            'wp_remote_post送信 form_id=%s json=%dバイト 結果=%s',
            $form_id, strlen($json),
            is_wp_error($response)
                ? 'エラー: ' . $response->get_error_message()
                : 'http=' . wp_remote_retrieve_response_code($response) . ' resp=' . substr(wp_remote_retrieve_body($response), 0, 200)
        ));
    }
}

/** SPENDA_FORMS_DEBUG が true のときだけ wp-content/uploads/ にログを書く */
function spenda_forms_debug_log_($message) {
    if (!defined('SPENDA_FORMS_DEBUG') || !SPENDA_FORMS_DEBUG) {
        return;
    }
    $dir = defined('WP_CONTENT_DIR') ? WP_CONTENT_DIR . '/uploads' : __DIR__;
    @file_put_contents(
        $dir . '/spenda-forms-to-sheets.log',
        date('Y-m-d H:i:s') . "\t" . $message . "\n",
        FILE_APPEND
    );
}
