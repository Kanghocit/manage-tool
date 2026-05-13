import express from 'express'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const policyPathCandidates = [
  path.resolve(process.cwd(), 'src', 'content', 'privacy-policy.vi.md'),
  path.resolve(__dirname, '..', 'content', 'privacy-policy.vi.md'),
]

async function readPrivacyPolicy(): Promise<string> {
  let lastError: unknown
  for (const policyPath of policyPathCandidates) {
    try {
      return await readFile(policyPath, 'utf8')
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

export const privacyRouter = express.Router()

privacyRouter.get('/privacy', async (_req, res, next) => {
  try {
    const markdown = await readPrivacyPolicy()
    const { marked } = await import('marked')
    marked.setOptions({
      gfm: true,
      breaks: false,
    })
    const contentHtml = marked.parse(markdown) as string
    res.type('html').send(`<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Chinh sach Bao mat - Ho tro Zalo</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f7fb;
      --surface: #ffffff;
      --text: #1f2937;
      --muted: #6b7280;
      --border: #e5e7eb;
      --primary: #2563eb;
      --shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: linear-gradient(180deg, #f8faff 0%, var(--bg) 180px);
      color: var(--text);
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.65;
    }
    .page {
      max-width: 980px;
      margin: 40px auto;
      padding: 0 20px 32px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .header {
      padding: 24px 28px 18px;
      border-bottom: 1px solid var(--border);
      background: #fcfdff;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      line-height: 1.3;
      letter-spacing: -0.02em;
    }
    .header p {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 14px;
    }
    article {
      padding: 28px;
    }
    article h1, article h2, article h3, article h4 {
      line-height: 1.35;
      margin-top: 1.65em;
      margin-bottom: 0.6em;
      letter-spacing: -0.01em;
    }
    article h1 { font-size: 2rem; margin-top: 0; }
    article h2 { font-size: 1.5rem; }
    article h3 { font-size: 1.18rem; }
    article p { margin: 0.72em 0; }
    article ul, article ol { padding-left: 1.3em; }
    article li { margin: 0.3em 0; }
    article hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 1.5em 0;
    }
    article table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
      font-size: 14px;
      display: block;
      overflow-x: auto;
    }
    article th, article td {
      border: 1px solid var(--border);
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
      min-width: 120px;
    }
    article th {
      background: #f8fafc;
      font-weight: 600;
    }
    article code {
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #dbeafe;
      border-radius: 6px;
      padding: 0.12em 0.4em;
      font-size: 0.92em;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    article a {
      color: var(--primary);
      text-decoration: none;
    }
    article a:hover { text-decoration: underline; }
    @media (max-width: 768px) {
      .page { margin: 16px auto; padding: 0 12px 20px; }
      .header { padding: 18px 18px 14px; }
      .header h1 { font-size: 22px; }
      article { padding: 18px; }
      article h1 { font-size: 1.6rem; }
      article h2 { font-size: 1.3rem; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="card">
      <header class="header">
        <h1>Chinh sach Bao mat</h1>
        <p>Ho tro Zalo (Zalo Assistant)</p>
      </header>
      <article>${contentHtml}</article>
    </section>
  </main>
</body>
</html>`)
  } catch (err) {
    next(err)
  }
})
