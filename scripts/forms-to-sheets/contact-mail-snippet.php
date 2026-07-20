<?php
/**
 * spendacorp.com/contact.html → mail.php に追記するスニペット。
 *
 * 配置方法:
 *   1) mail.php と同じディレクトリに `spenda-config.php` を新規作成し、下記 2 定数を定義
 *      (repo にコミットしない、.gitignore 対象):
 *        <?php
 *        define('SPENDA_GAS_URL',    'https://script.google.com/macros/s/AKfy.../exec');
 *        define('SPENDA_FORM_SECRET','GAS の Script Properties と同じシークレット文字列');
 *
 *   2) mail.php の冒頭(opening <?php の直後)に下記 1 行を追加:
 *        require_once __DIR__ . '/spenda-config.php';
 *
 *   3) mail.php の **末尾** (既存メール送信ロジックが終わった後) にこのファイルの中身を貼り付け。
 *      → メール送信成功/失敗に関わらず GAS にも通知。
 *      → GAS への送信が失敗してもメール送信フローには影響を与えない(silent fail)。
 *
 * 安全策:
 *   - timeout 5s で短く打ち切り(ユーザー応答を遅らせない)
 *   - FOLLOWLOCATION = true: GAS は script.google.com → script.googleusercontent.com にリダイレクトするため必須
 *   - ssl_verify_peer = true: 証明書検証
 *   - SPENDA_GAS_URL 未定義時は完全 no-op (本ファイル削除/未配備でも mail.php が動く)
 */

if (defined('SPENDA_GAS_URL') && SPENDA_GAS_URL) {
    // $_POST から正規化(contact.html の input name は日本語キー)
    $sp_get = function ($key) {
        if (!isset($_POST[$key])) return '';
        $v = $_POST[$key];
        if (is_array($v)) return implode(', ', array_map('strval', $v));
        return (string) $v;
    };

    $sp_payload = [
        'source'   => 'php-mail',
        'form_id'  => 'contact-html',
        'form_url' => $_SERVER['HTTP_REFERER'] ?? 'https://spendacorp.com/contact.html',
        'fields'   => [
            'name'    => $sp_get('お名前'),
            'company' => $sp_get('会社名'),
            'email'   => $sp_get('Email'),
            'tel'     => $sp_get('電話番号'),
            'kind'    => $sp_get('お問合せ種別'),
            'message' => $sp_get('お問い合わせ内容'),
        ],
        'raw'      => $_POST,
        'referrer' => $_SERVER['HTTP_REFERER'] ?? '',
        'secret'   => defined('SPENDA_FORM_SECRET') ? SPENDA_FORM_SECRET : '',
    ];

    $sp_json = json_encode($sp_payload, JSON_UNESCAPED_UNICODE);

    $sp_ch = curl_init(SPENDA_GAS_URL);
    curl_setopt_array($sp_ch, [
        CURLOPT_POST            => true,
        CURLOPT_POSTFIELDS      => $sp_json,
        // 'Expect:' 空指定で 100-continue を無効化(途中経路で本文が
        // 送られず GAS に空ボディが届く事象の予防)
        CURLOPT_HTTPHEADER      => ['Content-Type: application/json', 'Expect:'],
        CURLOPT_RETURNTRANSFER  => true,
        CURLOPT_TIMEOUT         => 5,
        CURLOPT_CONNECTTIMEOUT  => 3,
        CURLOPT_FOLLOWLOCATION  => true,
        CURLOPT_SSL_VERIFYPEER  => true,
    ]);
    $sp_resp = @curl_exec($sp_ch);
    $sp_err  = curl_error($sp_ch);
    $sp_code = curl_getinfo($sp_ch, CURLINFO_RESPONSE_CODE);
    @curl_close($sp_ch);

    // デバッグログ: spenda-config.php に define('SPENDA_FORMS_DEBUG', true); を
    // 追加すると mail.php と同じ階層に spenda-forms.log を出力する(解決後は外す)
    if (defined('SPENDA_FORMS_DEBUG') && SPENDA_FORMS_DEBUG) {
        @file_put_contents(
            __DIR__ . '/spenda-forms.log',
            date('Y-m-d H:i:s') . "\t" . sprintf(
                'contact-html json=%dバイト http=%s resp=%s err=%s',
                strlen($sp_json), $sp_code, substr((string) $sp_resp, 0, 200), $sp_err ?: '(なし)'
            ) . "\n",
            FILE_APPEND
        );
    }
}
