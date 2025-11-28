
# Document Converter (MD / HTML / DOCX)

本プロジェクトは、以下の 3 種類のファイル変換を Node.js 上で行うための、  
シンプルかつ拡張性の高いユーティリティです。

- **Markdown (.md) → HTML (.html)**
- **HTML (.html) → PDF (.pdf)**  ※日本語文字化け自動修正つき
- **Word (.docx) → HTML (.html)**

変換処理はすべて `converters.js` にまとめられ、  
実行スクリプト `run.js` は拡張子つきファイル名を指定して 1 ファイルを変換します。

---

## 🔧 必要環境

- Node.js 18 または 20（推奨）
- macOS / Windows / Linux 対応
- インターネット接続（初回の Puppeteer Chromium ダウンロード時のみ）

---

## 📁 ディレクトリ構成

```text
converter/
  converters.js     ← 変換ロジック（Markdown / HTML / Word）
  run.js            ← 変換実行スクリプト（引数でファイル指定）
  data/             ← 入力・出力ファイルをすべてここに置く
  package.json
  node_modules/
````

* **入力ファイル**も
* **変換後の出力ファイル**も

すべて `data` ディレクトリ直下にまとまります。

---

## 📦 インストール

```bash
cd converter
npm install marked puppeteer mammoth encoding-japanese
```

---

## 🚀 使い方

1. 変換したいファイルを `data` に置く
2. `node run.js <ファイル名>` で変換

例:

```text
data/sample.md
data/report.docx
data/page.html
data/人権特区QA.html
```

---

## ▶ 変換コマンド

拡張子つきファイル名を指定して実行：

```bash
node run.js sample.md
node run.js report.docx
node run.js page.html
node run.js 人権特区QA.html
```

---

## 🔄 変換ルール（自動判定）

`run.js` は **引数の拡張子** を見て変換モードを決めます。

| 入力ファイル（data 内） | 出力ファイル（同じ data 内） | 実行される変換     |
| -------------- | ----------------- | ----------- |
| `sample.md`    | `sample.html`     | MD → HTML   |
| `report.docx`  | `report.html`     | Word → HTML |
| `page.html`    | `page.pdf`        | HTML → PDF  |
| `人権特区QA.html`  | `人権特区QA.pdf`      | HTML → PDF  |

> 🔁 同じベース名で `.md` / `.docx` / `.html` が複数あっても、
> `run.js` に指定した **1 ファイルだけ** が処理されます（複数処理はしません）。

---

## 📤 入出力場所

すべての入出力は：

```text
converter/data/
```

に集約されます。

例：

```text
converter/
  data/
    sample.md          ← 入力 (Markdown)
    sample.html        ← 出力 (MD → HTML)
    sample.pdf         ← 出力 (HTML → PDF など)
    report.docx        ← 入力 (Word)
    report.html        ← 出力 (Word → HTML)
    人権特区QA.html    ← 入力 (HTML)
    人権特区QA.pdf     ← 出力 (HTML → PDF)
```

---

## 🧠 変換関数（converters.js）概要

### 1. `mdToHtml(baseName, inputDir, outputDir)`

* Markdown → HTML
* 事前に `preprocessMarkdown()` を通して、次を自動削除・修正:

  * 先頭の YAML / Marp フロントマター（`--- ... ---`）
  * 単独行 `marp: true`
  * 見出し内部の余計な `###` など
* UTF-8 & `<meta charset="UTF-8">` 付き HTML を生成

### 2. `htmlToPdf(baseName, inputDir, outputDir)`

* HTML → PDF
* 事前に `fixHtmlEncodingIfNeeded()` を実行して：

  * Shift_JIS / EUC-JP / ISO-2022-JP などでも自動で UTF-8 に変換
  * `<meta charset="UTF-8">` を挿入 or 修正
  * `</body>`, `</html>` が無ければ簡易補完
* その後 Puppeteer で PDF を生成

### 3. `wordToHtml(baseName, inputDir, outputDir, options?)`

* Word (.docx) → HTML
* `mammoth` を使って Word 文書を HTML に変換
* UTF-8 & `<meta charset="UTF-8">` 付き HTML テンプレートで包んで保存

---

## 📝 run.js（実行スクリプト）の挙動（概要）

```bash
node run.js <ファイル名(.md | .docx | .html)>
```

* `path.parse()` で `baseName` と `ext` を取得
* `ext` に応じて以下のどれか1つだけを実行：

  * `.md`   → `mdToHtml(baseName, dataDir, dataDir)`
  * `.docx` → `wordToHtml(baseName, dataDir, dataDir)`
  * `.html` → `htmlToPdf(baseName, dataDir, dataDir)`
* すべて `converter/data` の中で完結（入力も出力も data）

---

## ❗ 注意点・トラブルシューティング

### ❓ ENOENT: no such file or directory

```text
Error: ENOENT: no such file or directory, open '.../data/人権特区QA.html'
```

* 指定したファイルが `converter/data` に存在しません。
* 該当ファイルを `data` に置いてから再実行してください。

---

### ❓ “parse error near '}'” が出る

`node` の前にスペースがない場合に発生します。

* ❌ `converter %node run.js sample.md`
* ✅ `converter % node run.js sample.md`

---

### ❓ 日本語の文字化けが心配

* `.md` → `.html` のときは UTF-8 HTML を生成
* `.docx` → `.html` のときもテンプレートに `<meta charset="UTF-8">` を挿入
* `.html` → `.pdf` のときは、事前にエンコーディング自動判定＋UTF-8変換

→ そのため、**HTML → PDF 経路での日本語文字化けは極力防げる設計**になっています。

---

## 🏁 まとめ

このプロジェクトは、Word・Markdown・HTML の
**「見た目を壊さず、将来も使える」文書変換パイプライン**として設計されています。

* 入力も出力も `data` に集約
* 拡張子で変換モードを自動判定
* Markdown では Marp 等の制御記号を自動削除
* HTML ではエンコーディングを自動判定し、必要なときだけ UTF-8 に再変換

この構成により、**日本語ドキュメントの長期運用＋AI時代の再利用**に非常に向いたワークフローになります。

---
