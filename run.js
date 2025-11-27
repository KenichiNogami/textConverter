// run.js
import path from "path";
import { fileURLToPath } from "url";
import { mdToHtml, htmlToPdf, wordToHtml } from "./converters.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 入出力共通ディレクトリ（data 配下にすべて置く）
const dataDir = path.resolve(__dirname, "data");

// コマンドライン引数からファイル名（拡張子つき）を受け取る
// 例:
//   node run.js sample.md
//   node run.js report.docx
//   node run.js page.html
//   node run.js 人権特区QA.html
const [, , argFileName] = process.argv;

if (!argFileName) {
  console.error("使い方: node run.js <ファイル名(.md | .docx | .html)>");
  process.exit(1);
}

// ファイル名と拡張子を分解
const parsed = path.parse(argFileName);
const baseName = parsed.name;                 // "sample" / "人権特区QA" など
const ext = (parsed.ext || "").toLowerCase(); // ".md" / ".docx" / ".html" など

console.log(`▶ 入力ファイル指定: ${argFileName}`);
console.log(`   baseName : ${baseName}`);
console.log(`   ext      : ${ext}`);
console.log(`   dataDir  : ${dataDir}`);

async function main() {
  if (ext === ".md") {
    console.log(`\n=== MD → HTML (${baseName}.md → ${baseName}.html) ===`);
    await mdToHtml(baseName, dataDir, dataDir);
    console.log("✅ MD → HTML 変換完了");
  } else if (ext === ".docx") {
    console.log(`\n=== Word → HTML (${baseName}.docx → ${baseName}.html) ===`);
    await wordToHtml(baseName, dataDir, dataDir);
    console.log("✅ Word → HTML 変換完了");
  } else if (ext === ".html" || ext === ".htm") {
    console.log(`\n=== HTML → PDF (${baseName}.html → ${baseName}.pdf) ===`);
    await htmlToPdf(baseName, dataDir, dataDir);
    console.log("✅ HTML → PDF 変換完了");
  } else {
    console.error("❌ 対応していない拡張子です。使用可能: .md / .docx / .html");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("❌ 実行中にエラー:", err);
  process.exit(1);
});
