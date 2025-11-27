// converters.js
import fs from "fs/promises";
import path from "path";
import { marked } from "marked";
import puppeteer from "puppeteer";
import mammoth from "mammoth";
import Encoding from "encoding-japanese";

/**
 * Markdown 前処理
 * - 先頭の YAML / Marp フロントマター（--- ... ---）を削除
 * - 単独行の "marp: true" を削除
 * - 見出し内部に二重に付いている "###" などを整理
 *
 * 例:
 *   ---\nmarp: true\n--- → 削除
 *   "## ### **Q1**" → "## **Q1**"
 *
 * @param {string} md
 * @returns {string}
 */
function preprocessMarkdown(md) {
  let out = md;

  // 1. 先頭の YAML / Marp フロントマターを削除
  //    --- から始まり、次の --- までを丸ごと消す
  out = out.replace(/^---[\s\S]*?---\s*/m, "");

  // 2. 単独行の "marp: true" を削除（保険）
  out = out.replace(/^\s*marp:\s*true\s*$/gmi, "");

  // 3. 見出しの中に残っている先頭の "### " を除去
  //    例: "## ### **Q1...**" → "## **Q1...**"
  out = out.replace(/^(#{1,6})\s+#+\s+/gm, "$1 ");

  // 4. 先頭の空白行を軽く整理
  out = out.replace(/^\s+/, "");

  return out;
}

/**
 * HTMLファイルのエンコーディングを判定し、
 * 必要な場合のみ UTF-8 に再変換して上書き保存する。
 *
 * - 元が Shift_JIS / EUC-JP / ISO-2022-JP 等でも自動で UTF-8 に変換
 * - <meta charset="UTF-8"> を必ず挿入 or 置換
 * - </body>, </html> が無ければ軽く補完
 *
 * @param {string} filePath
 * @param {string} [forceEnc] 例: "SJIS"（通常は不要）
 * @returns {Promise<{ needFix: boolean, enc: string | null }>}
 */
async function fixHtmlEncodingIfNeeded(filePath, forceEnc) {
  const buffer = await fs.readFile(filePath); // Buffer
  const bytes = new Uint8Array(buffer);       // Uint8Array

  // 1) 文字コード判定
  let enc = forceEnc || Encoding.detect(bytes); // 'UTF8' | 'SJIS' | 'EUCJP' など

  // 2) ISO-2022-JP の可能性チェック（JISエスケープ）
  const bin = buffer.toString("binary");
  const hasEsc =
    buffer.includes(0x1b) && (bin.includes("$B") || bin.includes("(B"));
  if (!forceEnc && hasEsc) enc = "ISO-2022-JP";

  let needFix = false;
  let content;

  // 3) UTF-8 以外なら UTF-8相当の Unicode 文字列へ変換
  if (enc && enc.toUpperCase() !== "UTF8") {
    content = Encoding.convert(bytes, {
      to: "UNICODE",
      from: enc,
      type: "string",
    });
    needFix = true;
  } else {
    // 一応 UTF-8 として読む
    content = buffer.toString("utf8");
  }

  // 4) <meta charset> を UTF-8 に統一
  const hasMeta = /<meta[^>]*charset[^>]*>/i.test(content);
  const isUtf8Meta = /<meta[^>]*charset=["']?utf-8["']?/i.test(content);

  if (!hasMeta || !isUtf8Meta) {
    needFix = true;
    if (hasMeta) {
      // 既存 meta charset を置換
      content = content.replace(
        /<meta[^>]*charset[^>]*>/i,
        '<meta charset="UTF-8">'
      );
    } else if (/<head[^>]*>/i.test(content)) {
      // <head> がある場合は直後に挿入
      content = content.replace(
        /<head[^>]*>/i,
        (m) => `${m}\n  <meta charset="UTF-8">`
      );
    } else {
      // <head> が無い場合は先頭に追加
      content = `<head><meta charset="UTF-8"></head>\n${content}`;
    }
  }

  // 5) body/html の閉じタグが無ければ軽く補完
  if (!/<\/body>/i.test(content)) {
    content += "\n</body>";
    needFix = true;
  }
  if (!/<\/html>/i.test(content)) {
    content += "\n</html>";
    needFix = true;
  }

  if (needFix) {
    await fs.writeFile(filePath, content, "utf8");
    console.log(
      `✅ HTMLエンコーディングを修正しました: ${filePath} / 推定エンコーディング: ${enc}`
    );
  } else {
    console.log(
      `ℹ️ 文字化けなしと判定・修正スキップ: ${filePath} / 推定エンコーディング: ${enc}`
    );
  }

  return { needFix, enc: enc || null };
}

/**
 * Markdown(.md) → HTML(.html)
 *
 * - Marp 用のフロントマターや制御記号を事前に削除
 * - UTF-8 / <meta charset="UTF-8"> を含む HTML を生成
 *
 * @param {string} baseName   - 拡張子なしファイル名
 * @param {string} inputDir   - 入力MDファイルのディレクトリ
 * @param {string} outputDir  - 出力HTMLファイルのディレクトリ
 * @returns {Promise<string>} - 生成された HTML 全体
 */
export async function mdToHtml(baseName, inputDir, outputDir) {
  const inputPath = path.resolve(inputDir, `${baseName}.md`);
  const outputPath = path.resolve(outputDir, `${baseName}.html`);

  let md = await fs.readFile(inputPath, "utf8");

  // Marpフロントマターや余計な "###" 等を削除
  md = preprocessMarkdown(md);

  const bodyHtml = marked(md);

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <title>${baseName}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue",
                       "Segoe UI", sans-serif;
          font-size: 16px;
          line-height: 1.6;
          margin: 40px;
          max-width: 900px;
        }
        h1, h2, h3, h4, h5 {
          font-weight: 600;
        }
        p {
          margin: 0 0 0.7em;
        }
        pre {
          background: #f5f5f5;
          padding: 8px 12px;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 0.9em;
        }
        code {
          font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
        }
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 12px 0;
        }
        table, th, td {
          border: 1px solid #ccc;
        }
        th, td {
          padding: 6px 8px;
        }
      </style>
    </head>
    <body>
      ${bodyHtml}
    </body>
    </html>
  `;

  await fs.writeFile(outputPath, fullHtml, "utf8");
  return fullHtml;
}

/**
 * HTML(.html) → PDF(.pdf)
 *
 * - 事前に HTML の文字コードを自動判定
 * - 必要なら UTF-8 に変換して上書き
 * - その後に PDF を生成
 *
 * @param {string} baseName   - 拡張子なしファイル名
 * @param {string} inputDir   - 入力HTMLファイルのディレクトリ
 * @param {string} outputDir  - 出力PDFファイルのディレクトリ
 * @returns {Promise<void>}
 */
export async function htmlToPdf(baseName, inputDir, outputDir) {
  const inputPath = path.resolve(inputDir, `${baseName}.html`);
  const outputPath = path.resolve(outputDir, `${baseName}.pdf`);

  // PDF生成前に文字化け対策（必要なときだけ UTF-8 に変換して上書き）
  await fixHtmlEncodingIfNeeded(inputPath);

  // UTF-8 & 正しい <meta charset> 前提で読み込む
  const html = await fs.readFile(inputPath, "utf8");

  const browser = await puppeteer.launch({
    headless: "new",
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        right: "20mm",
        bottom: "20mm",
        left: "20mm",
      },
    });
  } finally {
    await browser.close();
  }
}

/**
 * Word(.docx) → HTML(.html)
 *
 * - mammoth で Word 文書を HTML に変換
 * - UTF-8 & <meta charset="UTF-8"> 付きの HTML テンプレで包む
 *
 * @param {string} baseName   - 拡張子なしファイル名
 * @param {string} inputDir   - 入力DOCXファイルのディレクトリ
 * @param {string} outputDir  - 出力HTMLファイルのディレクトリ
 * @param {object} [options]  - mammoth オプション
 * @returns {Promise<string>} - 生成された HTML 全体
 */
export async function wordToHtml(baseName, inputDir, outputDir, options = {}) {
  const inputPath = path.resolve(inputDir, `${baseName}.docx`);
  const outputPath = path.resolve(outputDir, `${baseName}.html`);

  const mammothOptions = {
    styleMap: [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
    ],
    ...options,
  };

  const result = await mammoth.convertToHtml(
    { path: inputPath },
    mammothOptions
  );

  const bodyHtml = result.value;
  const messages = result.messages || [];

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <title>${baseName}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue",
                       "Segoe UI", sans-serif;
          font-size: 16px;
          line-height: 1.6;
          margin: 40px;
          max-width: 900px;
        }
        h1, h2, h3, h4, h5 {
          font-weight: 600;
        }
        p {
          margin: 0 0 0.7em;
        }
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 12px 0;
        }
        table, th, td {
          border: 1px solid #ccc;
        }
        th, td {
          padding: 6px 8px;
        }
      </style>
    </head>
    <body>
      ${bodyHtml}
    </body>
    </html>
  `;

  await fs.writeFile(outputPath, fullHtml, "utf8");

  if (messages.length > 0) {
    console.warn(`mammoth messages for ${baseName}:`);
    for (const m of messages) {
      console.warn(`- [${m.type}] ${m.message}`);
    }
  }

  return fullHtml;
}
