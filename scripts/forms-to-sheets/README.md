# forms-to-sheets

spendacorp.com の Web フォーム送信内容を **直接 Google Sheets に記録** するブリッジ。
HubSpot を経由しない、サーバーサイド統合方式。

## アーキテクチャ

```
[/media/* の MW WP Form]              [contact.html → mail.php]
        │ mwform_after_send hook              │ mail 送信後
        │                                     │
        ▼                                     ▼
[wp-mwform-hook.php]                  [contact-mail-snippet.php]
   wp_remote_post (JSON)                 curl POST (JSON)
        │                                     │
        └──────────┐         ┌────────────────┘
                   ▼         ▼
            [GAS Web App: gas-webapp.gs]
                   │
                   ▼
            [Google Sheets: フォーム関連 / シート1]
              (timestamp, source, form_id, form_url,
               name, company, email, tel, kind,
               message, referrer, raw_json)
```

| 経路 | 対象 | 実装ファイル |
|---|---|---|
| WP プラグイン | `/media/form-*`, `/media/dl-contents-form-content01-12` 等の MW WP Form 全フォーム | `wp-mwform-hook.php` |
| PHP スニペット | `/contact.html` → `mail.php` | `contact-mail-snippet.php` |
| GAS Web App | 受信エンドポイント + Sheet 書き込み | `gas-webapp.gs`, `appsscript.json` |

## なぜ HubSpot を使わないか

- 送信内容の **アーカイブ目的なら HubSpot CRM は過剰**。Sheets で十分。
- 既存の MW WP Form / `mail.php` フローは触らず、**並行で Sheets にも送る**(二重化)。
- HubSpot サブスクリプション不要 / 月額ゼロ運用。
- 既存の `scripts/hubspot-form-relay/`(Gmail→Claude→Slack 返信案)は別目的で共存。

## デプロイ手順

### Step 1. Google Sheet 準備

対象 Sheet: **「フォーム関連」**
URL: https://docs.google.com/spreadsheets/d/1oELhU6ZZz2pjN_RylQ5NjidcS52nkbQa-4xqpOHm_K4/

`シート1` の A1:L1 にヘッダ:
```
timestamp | source | form_id | form_url | name | company | email | tel | kind | message | referrer | raw_json
```
(配置済み、2026-05-27)

### Step 2. GAS Web App デプロイ

1. 上記 Sheet を開く → **拡張機能 → Apps Script**
2. プロジェクト名を `forms-to-sheets` に変更
3. 左メニュー歯車 ⚙️ **プロジェクトの設定** → **「appsscript.json」マニフェスト ファイルをエディタで表示する** ON
4. `appsscript.json` の内容を [appsscript.json](appsscript.json) で完全置き換え
5. `コード.gs` の内容を [gas-webapp.gs](gas-webapp.gs) で完全置き換え
6. **プロジェクトの設定 → スクリプト プロパティ** で以下を追加:
   - `FORM_SHARED_SECRET`: 十分長いランダム文字列(`openssl rand -hex 32` 等で生成)
   - (任意) `SHEET_TAB`: 既定 `シート1` 以外に書き込みたい場合
7. 右上 **デプロイ → 新しいデプロイ**:
   - 種類: **ウェブアプリ**
   - 説明: `forms-to-sheets v1.0`
   - 次のユーザーとして実行: **自分**
   - アクセスできるユーザー: **全員**
   - **デプロイ** → 認証 → 表示された **ウェブアプリ URL** をコピー
   - 形式: `https://script.google.com/macros/s/AKfy.../exec`
8. 動作確認:
   ```bash
   curl -L -X POST -H "Content-Type: application/json" \
        -d '{"source":"curl-test","secret":"<step6で設定したシークレット>","fields":{"name":"テスト","email":"t@example.com","message":"hello"}}' \
        "<step7のURL>"
   ```
   → Sheet の `シート1` に 1 行追加されれば OK。

### Step 3. WordPress 統合 (`/media/*` 全フォーム)

1. `wp-config.php` に以下 2 行を追加(リポにコミット禁止):
   ```php
   define('SPENDA_GAS_URL',    'https://script.google.com/macros/s/AKfy.../exec');
   define('SPENDA_FORM_SECRET','step6 と同じシークレット');
   ```
2. [wp-mwform-hook.php](wp-mwform-hook.php) を **`wp-content/mu-plugins/spenda-forms-to-sheets.php`** として配置
   - `mu-plugins/` ディレクトリがなければ作成
   - mu-plugins は自動有効化(管理画面での有効化操作不要)
3. テスト送信:
   - 任意のフォーム(例: `/media/form-freeconsulting/`)で実送信
   - メールが届くか確認 + Sheet に行が追加されるか確認
4. 全フォーム共通で 1 度の deploy が効く(MW WP Form ベースなら全捕捉)

### Step 4. contact.html 統合

1. `mail.php` と同じディレクトリに `spenda-config.php` を作成(SCP/SFTP で):
   ```php
   <?php
   define('SPENDA_GAS_URL',    'https://script.google.com/macros/s/AKfy.../exec');
   define('SPENDA_FORM_SECRET','step6 と同じシークレット');
   ```
2. `mail.php` の冒頭(`<?php` の直後)に追加:
   ```php
   require_once __DIR__ . '/spenda-config.php';
   ```
3. `mail.php` の **末尾**(既存メール送信ロジックの後)に [contact-mail-snippet.php](contact-mail-snippet.php) の中身(`<?php` 行除く)を貼り付け
4. テスト送信して Sheet に行が追加されるか確認

### Step 5. 他のフォーム

`/form-webadsplus/`, `/form-agency/` 等ルート直下の他フォームは別 PR で対応(構造未調査)。
WP かどうかで Step 3 or Step 4 のどちらかに割り当て。

## 運用

### モニタリング

- Sheet を時々眺める(行が積み上がっていれば OK)
- GAS の「実行数」を **Apps Script ダッシュボード**で確認(エラー率)
- Slack 通知が必要なら GAS の `doPost` 内に Incoming Webhook 呼び出しを追加

### 障害時

| 症状 | 確認 | 対応 |
|---|---|---|
| Sheet に行が増えない | GAS の「実行履歴」でエラー確認 | スクリプトのエラーを修正、再デプロイ |
| GAS の認証エラー | デプロイユーザーが Sheet 編集可能か | アクセス権限を見直し |
| WP からだけ届かない | wp-config の 2 定数を確認 / mu-plugins に配置されているか | 再配置 |
| mail.php からだけ届かない | サーバーの curl 拡張が有効か / spenda-config.php の require 行 | curl_init を error_log で出力して切り分け |
| 大量スパム | reCAPTCHA は MW WP Form 側で機能(mwform_after_send は reCAPTCHA 後発火) | 必要なら GAS 側でも IP / honeypot ガード追加 |

### セキュリティ

- `FORM_SHARED_SECRET` は **repo にコミットしない**(`wp-config.php` および `mail.php` ディレクトリの `spenda-config.php` に)
- GAS の **アクセス権限を「全員」** にしているため、シークレット未検証だと誰でも書き込み可能になる。シークレット必須運用。
- secrets を漏らした場合: GAS の Script Properties で `FORM_SHARED_SECRET` を新しい値に更新 → 同時に WP/mail.php の定数も更新(=旧シークレットでの POST は弾かれる)

## ファイル一覧

| ファイル | 配置先 |
|---|---|
| `gas-webapp.gs` | Apps Script の `コード.gs` に貼り付け |
| `appsscript.json` | Apps Script のマニフェスト |
| `wp-mwform-hook.php` | WordPress `wp-content/mu-plugins/spenda-forms-to-sheets.php` |
| `contact-mail-snippet.php` | 汎用版: 既存 `mail.php` の末尾に追記する形(別ホスト向け) |
| `spendacorp-mail.php` | **spendacorp.com 専用 mail.php 全置換版** (既存 GAS 統合 AKfycbyG8ZE6nAU... を廃止し共有シークレット方式に統一) |

### spendacorp.com の mail.php を置き換える場合

既存の `mail.php` には別の GAS 統合 (`AKfycbyG8ZE6nAU.../exec` + `api_key` 認証) がハードコードされていたため、ファイル全体を `spendacorp-mail.php` で置き換える形にしてある。

```bash
# サーバー上で
cp mail.php mail.php.bak.$(date +%Y%m%d)

# repo から取得して上書き (private repo の場合は手元で clone して scp)
curl -fsSL https://raw.githubusercontent.com/spenda-agency/openclaw-vps/main/scripts/forms-to-sheets/spendacorp-mail.php \
  -o mail.php

# 同階層に設定値ファイルを作成 (リポにコミットしない)
cat > spenda-config.php <<'EOF'
<?php
define('SPENDA_GAS_URL',    'https://script.google.com/macros/s/<新/exec URL>/exec');
define('SPENDA_FORM_SECRET','<GAS の FORM_SHARED_SECRET と同値>');
EOF
chmod 600 spenda-config.php
```

緊急停止: `mv spenda-config.php spenda-config.php.disabled` で `SPENDA_GAS_URL` が undefined になり GAS 連携が no-op に倒れる(メール送信は通常稼働を維持)。

## 既存資源との関係

- **対象 Sheet**: `1oELhU6ZZz2pjN_RylQ5NjidcS52nkbQa-4xqpOHm_K4` (フォーム関連)
- **Slack 通知**: 未実装。必要なら GAS の `doPost` 内に Incoming Webhook 呼び出しを追加(別 PR 推奨)
- **`scripts/hubspot-form-relay/`**: HubSpot 経由で Gmail を Claude に通す別系統 → 共存(返信案生成と問い合わせアーカイブで役割分担)
