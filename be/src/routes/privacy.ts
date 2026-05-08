import express from 'express'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const policyPath = path.resolve(__dirname, '..', 'content', 'privacy-policy.vi.md')

export const privacyRouter = express.Router()

const toSafeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

privacyRouter.get('/privacy', async (_req, res, next) => {
  try {
    const markdown = await readFile(policyPath, 'utf8')
    res.type('html').send(`<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Chinh sach Bao mat - Ho tro Zalo</title>
  <style>
    body { margin: 0; padding: 24px; background: #f7f7fb; color: #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    main { max-width: 980px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08); }
    pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; font: 15px/1.65 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body>
  <main>
    <pre>${toSafeHtml(markdown)}</pre>
  </main>
</body>
</html>`)
  } catch (err) {
    next(err)
  }
})
