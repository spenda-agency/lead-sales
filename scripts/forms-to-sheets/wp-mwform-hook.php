<?php
/**
 * Plugin Name: SPENDA Forms-to-Sheets bridge
 * Description: MW WP Form の正常送信完了時に GAS Web App へ POST して Google Sheets に記録
 * Version:     1.0.0
 * Author:      SPENDA / lead-sales
 *
 * 設置先:
 *   wp-content/mu-plugins/spenda-forms-to-sheets.php
 *   ※ mu-plugins 配下は自動有効化(WordPress 管理画面での有効化不要)
 *
 * 設定:
 *   wp-config.php に下記 2 行を追加(repo にはコミットしない):
 *     define('SPENDA_GAS_URL',    'https://script.google.com/macros/s/AKfy.../exec');
 *     define('SPENDA_FORM_SECRET','GAS の Script Properties と同じシークレット文字列');
 *
 *   このファイル自体は repo から `git pull` でアップデート、定数は wp-config.php に置く
 *   ことで「コードと設定値を分離」。
 *
 * 対象フォーム:
 *   spendacorp.com/media/* 配下の MW WP Form 全フォーム(20+ 個)
 *   フォーム ID 別の特殊処理が必要になったら $form_id を分岐させて拡張する。
 *
 * 安全策:
 *   - blocking=true + timeout 5s。blocking=false はホスティング環境(mixhost等)の
 *     cURLで本文送信前に接続が切られ、GAS側に「空ボディ」が届く事象を確認したため
 *     使用しない。送信失敗してもフォーム処理自体には影響しない
 *   - sslverify=true で証明書検証(GAS の証明書)
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

    $response = wp_remote_post(SPENDA_GAS_URL, [
        'method'    => 'POST',
        'headers'   => ['Content-Type' => 'application/json'],
        'body'      => wp_json_encode($payload),
        'timeout'   => 5,
        // blocking=false だと環境によりcURLが本文送信前に接続を切り、
        // GAS側に空ボディが届く(実事象)。必ず true にする。
        'blocking'  => true,
        'sslverify' => true,
    ]);

    // 失敗時のみエラーログに残す(成功時は何も出さない)
    if (is_wp_error($response)) {
        error_log('[spenda-forms-to-sheets] GAS送信失敗: ' . $response->get_error_message());
    }
}
