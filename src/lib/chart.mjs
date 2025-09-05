// src/lib/chart.mjs
import fs from "node:fs/promises";
import path from "node:path";

export async function writeChartHTML(outPath, { title, type, labels, data }) {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body { height: 100%; margin: 0; font-family: ui-sans-serif, system-ui, Arial; }
    .wrap { padding: 16px; }
    h1 { font-size: 18px; margin: 0 0 12px; }
    .box { height: 70vh; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(title)}</h1>
    <div class="box"><canvas id="c"></canvas></div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    const ctx = document.getElementById('c').getContext('2d');
    new Chart(ctx, {
      type: ${JSON.stringify(type)},
      data: {
        labels: ${JSON.stringify(labels)},
        datasets: [{
          label: ${JSON.stringify(title)},
          data: ${JSON.stringify(data)}
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  </script>
</body>
</html>`;
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, html);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
