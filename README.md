# 交流会進行アシスタント（タイマーPWA）

テーブルリーダーがスマホ1台で交流会の進行を管理するためのタイマーPWAです。

## 機能

- テーブル人数 3〜6人に対応
- 発表タイマー・1on1質問タイマーの自動進行
- 0秒でビープ音・次工程へ自動遷移
- スリープ防止（Wake Lock API）
- オフライン動作（PWA）

## セットアップ

```bash
npm install
```

## 起動方法（開発）

```bash
npm run dev
# → http://localhost:5173 で起動
```

## ビルド

```bash
npm run build
# → dist/ に出力
```

## ユニットテスト

```bash
npm run test
```

## 環境変数

`.env.local` を作成して設定してください。

```env
VITE_SURVEY_URL=https://forms.gle/your-form-url
```

未設定時は `https://forms.gle/example` にフォールバックします。

## Vercelデプロイ

1. [Vercel](https://vercel.com) にプロジェクトをインポート
2. ビルドコマンド: `npm run build`
3. 出力ディレクトリ: `dist`
4. 環境変数 `VITE_SURVEY_URL` を設定

## QR運用方法

1. VercelデプロイURL（例: `https://your-app.vercel.app`）のQRコードを生成
2. [QRコード生成ツール](https://qr.io) などを使用
3. 印刷して各テーブルに配布、またはスクリーン表示

## オフライン利用の注意

- 初回はオンライン環境でページを読み込んでください（PWAキャッシュが完了します）
- 2回目以降はオフラインでもタイマー機能が動作します
- アンケートページへの遷移はオンライン接続が必要です

## 順番ルール

| 参加者 | 役割 |
|---|---|
| A | テーブルリーダー（発表は最後、質問は最初） |
| B〜F | 一般参加者 |

**発表順**: B → C → … → A（リーダーが最後）

**質問順（例: Bが発表）**: A → C → D → … （リーダー優先）

**質問順（Aが発表）**: B → C → D → … （P2から順番）
# koryukai-timer
