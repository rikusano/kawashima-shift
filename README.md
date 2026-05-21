# 川島センター シフト管理ウェブアプリ

既存の Excel シフト管理表（縦＝日付 / 横＝コース）の運用をデジタル化する社内ツールです。

* `/driver` … ドライバーが翌月の出勤可否を入力
* `/admin` … 管理者が回答状況を確認・シフトを割当
* Excel エクスポートで既存と同じレイアウトの .xlsx を出力

## 技術スタック

React + Vite + TypeScript / Supabase / Tailwind CSS / date-fns / SheetJS (xlsx) / Netlify

## セットアップ

### 1. Supabase プロジェクト作成

1. <https://supabase.com/> で新規プロジェクトを作成
2. **SQL Editor** で `supabase/migrations/001_initial.sql` の中身を全部貼り付けて実行
3. 続けて `supabase/seed.sql` を実行（初期の名簿・コースが入ります）
4. **Project Settings → API** で
   * Project URL
   * `anon` public key
   を控える

### 2. 環境変数

`.env.example` をコピーして `.env` を作成し、編集します。

```
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxxxx
# 管理画面の簡易パスワード（任意。未設定なら誰でも開ける）
VITE_ADMIN_PASSWORD=
```

### 3. ローカル起動

```bash
npm install
npm run dev
```

`http://localhost:5173/` を開く。

### 4. Netlify デプロイ

* リポジトリを Netlify に接続するだけで `netlify.toml` の設定に沿ってビルドされます
* Site settings → Environment variables に
  * `VITE_SUPABASE_URL`
  * `VITE_SUPABASE_ANON_KEY`
  * （任意）`VITE_ADMIN_PASSWORD`
  を設定
* SPA のため `netlify.toml` で全パスを `/index.html` にリダイレクトしています

## 画面構成

### `/driver` ドライバー入力
* 名前を自由入力。名簿不一致時は「もしかして：○○」を提示
* 翌月カレンダー（マンスリービュー）で各日付を `出勤可 / 応相談 / 休み希望` から選択
* 一括設定（平日すべて出勤可、土日休み希望、など）
* 各日付に備考メモを記入可能
* 同じ名前で再アクセスすれば編集可能

### `/admin` 管理画面
* **サマリー** … 回答状況一覧、未回答者の名前をクリップボードにコピー
* **シフト割当** … 縦＝日付・横＝コースの Excel 風グリッド。
  * セルクリック → その日「出勤可」のドライバーのみがプルダウンに出る
  * 「応相談」は黄色マーク。他コースで割当済みはグレーアウト（二重選択は警告付きで許可）
  * 鉛筆アイコンで「自由記述モード」に切替（自由記述セルは右下に印）
  * 各日付の備考列、`全休` `2稼働` のワンタッチ設定
  * ドライバー別の今月稼働日数を自動集計
  * **Excel 出力** … `YYYY年M月` シート名で既存レイアウト互換の .xlsx をダウンロード
* **名簿** … ドライバーの追加・編集・削除・並び替え
* **コース** … コース名の追加・編集・削除・並び替え
* **月設定** … 月の追加、月ごとのコース構成と並び替え、ステータス（収集中／割当中／確定）

## データモデル

* `drivers` … 名簿
* `courses` … コースマスタ
* `months` … 対象月（年・月・ステータス）
* `month_courses` … 月ごとのコース構成（4月と5月で構成が違う場合に対応）
* `driver_availability` … ドライバーの出勤可否回答
* `shift_assignments` … 確定シフト（選択モード or 自由記述）
* `day_notes` … 日付ごとの備考

詳細は [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql) を参照。

## 注意

* RLS は社内ツール想定で `anon` から全権限を許可しています。外部公開する場合は policy を見直してください。
* 管理者画面のパスワードは `sessionStorage` ベースの簡易ガードです。本格的な認可は Supabase Auth に置き換えてください。
