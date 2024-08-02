#!/usr/bin/env node

const fs = require("fs");
const exec = require("child_process").exec;

if (!fs.existsSync("./.badges")) fs.mkdirSync("./.badges");

function createBadge(label, value, leftWidth, rightWidth, color, filename) {
  const totalWidth = leftWidth + rightWidth;
  const svg = /*html*/ `
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${value}">
        <title>${label}: ${value}</title>
        <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
        <clipPath id="r"><rect width="${totalWidth}" height="20" rx="3" fill="#fff"/></clipPath>
        <g clip-path="url(#r)">
            <rect width="${leftWidth}" height="20" fill="#555"/>
            <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${color}"/>
            <rect width="${totalWidth}" height="20" fill="url(#s)"/></g>
            <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
            <text aria-hidden="true" x="${
              5 * leftWidth
            }" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${label}</text>
            <text x="${
              5 * leftWidth
            }" y="140" transform="scale(.1)" fill="#fff">${label}</text>
            <text aria-hidden="true" x="${
              10 * leftWidth + value.toString().length + 5 * rightWidth
            }" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${value}</text>
            <text x="${
              10 * leftWidth + value.toString().length + 5 * rightWidth
            }" y="140" transform="scale(.1)" fill="#fff">${value}</text>
        </g>
    </svg>
    `;
  fs.writeFileSync(filename, svg, "utf8");
}

exec("tokei . --output json", (error, stdout, stderr) => {
  if (error) {
    console.log(
      "Tokei not installed. Skipping lines of code and file count badge."
    );
    return;
  }
  const totalStats = JSON.parse(stdout)["Total"];
  const totalLinesOfCode = totalStats["code"];
  const totalFiles = Object.values(totalStats["children"])
    .map((x) => x.length)
    .reduce((a, b) => a + b, 0);
  createBadge(
    "Lines of Code",
    Intl.NumberFormat("en-US", { notation: "compact" }).format(
      totalLinesOfCode
    ),
    87,
    50,
    "#007ec6",
    "./.badges/lines-of-code.svg"
  );
  createBadge(
    "Files",
    totalFiles,
    40,
    28,
    "#007ec6",
    "./.badges/file-count.svg"
  );
});
