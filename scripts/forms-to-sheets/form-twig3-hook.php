<?php
/**
 * form-twig3 (Twig+YAML 独自PHPメーラー) → GAS forms-to-sheets 連携フック。
 *
 * 対象: spendacorp.com ルート直下の form-twig3 系フォーム
 *   /form-webadsplus/  /form-agency/  /form-aibidatasupport/
 *   /form-lsmultibuilder/  /form-lookerstudio-dx/
 * （いずれもディレクトリ違いで index.php の構造は同一）
 *
 * 配置方法:
 *   1) 各フォームのディレクトリ(index.php と同じ階層)にこのファイルを置く。
 *   2) 同ディレクトリに設定値ファイル `spenda-config.php` を作成(リポにコミット禁止):
 *        <?php
 *        define('SPENDA_GAS_URL',    'https://script.google.com/macros/s/AKfy.../exec');
 *        define('SPENDA_FORM_SECRET','GAS の Script Properties と同じシークレット文字列');
 *   3) index.php の exec アクション成功後、`setLog($data['yaml']['field'], $data['form']);`
 *      の直後に次の2行を追加:
 *        require_once __DIR__ . '/form-twig3-hook.php';
 *        spenda_twig_forms_to_sheets($data['form']);
 *
 * 安全策:
 *   - setLog 到達＝管理者/ユーザーへのメール送信が成功済み(失敗時は手前で exit)
 *     なので、記録されるのは正常送信のみ。
 *   - SPENDA_GAS_URL 未定義なら完全 no-op(このファイル/設定が無くても index.php は動く)。
 *   - timeout 5s / FOLLOWLOCATION=true(GAS は googleusercontent へリダイレクト) /
 *     SSL_VERIFYPEER=true。
 *   - GAS への送信失敗はフォーム処理に影響させない(silent fail)。
 *
 * 列マッピング:
 *   config.yaml のフィールド名はフォームにより異なりうるため、$form 全体を fields と
 *   raw の両方で送る。GAS 側(gas-webapp.gs の firstFilled_)が
 *   name/company/email/tel/kind/message を別名解決する。想定外のフィールド名でも
 *   raw_json に全項目が残るので取りこぼしはない。列に入らない場合は gas-webapp.gs の
 *   別名リストに実際のフィールド名を追加する。
 */

// 設定値(定数)を読み込む。無ければ後段で no-op。
@include __DIR__ . '/spenda-config.php';

if (!function_exists('spenda_twig_forms_to_sheets')) {
    /**
     * @param array $form  index.php の $data['form'](フィールド名 => 値 の連想配列)
     */
    function spenda_twig_forms_to_sheets($form)
    {
        if (!defined('SPENDA_GAS_URL') || !SPENDA_GAS_URL) {
            return; // 未設定なら何もしない
        }
        if (!is_array($form)) {
            $form = array();
        }

        // 配列値(チェックボックス等)は読みやすいよう文字列化
        $fields = array();
        foreach ($form as $k => $v) {
            $fields[(string) $k] = is_array($v) ? implode(', ', array_map('strval', $v)) : (string) $v;
        }

        $scheme   = (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') ? 'http://' : 'https://';
        $form_url = isset($_SERVER['HTTP_HOST'], $_SERVER['REQUEST_URI'])
            ? $scheme . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI']
            : (isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : '');

        $payload = array(
            'source'   => 'php-twig',
            'form_id'  => basename(__DIR__), // 例: form-webadsplus
            'form_url' => $form_url,
            'fields'   => $fields,
            'raw'      => $fields,
            'referrer' => isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : '',
            'secret'   => defined('SPENDA_FORM_SECRET') ? SPENDA_FORM_SECRET : '',
        );

        $json = json_encode($payload, JSON_UNESCAPED_UNICODE);

        $ch = curl_init(SPENDA_GAS_URL);
        curl_setopt_array($ch, array(
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $json,
            CURLOPT_HTTPHEADER     => array('Content-Type: application/json'),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 5,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => true,
        ));
        @curl_exec($ch);
        @curl_close($ch);
    }
}
