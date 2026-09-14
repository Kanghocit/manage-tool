import fs from 'fs'

import { extractPdfText, parseEtsKeyPdfText } from '../src/lib/caseStudyParser'

async function main() {
  const pdfPath =
    process.argv[2] ??
    '/Users/kang/.cursor/projects/Users-kang-Downloads-zalo-tools-manage-tool/attachments/3238bc97-065e-4bae-a4b1-436191e01191/ETS_2026_READING_TEST_1-_KEY_compressed.pdf'
  const buf = fs.readFileSync(pdfPath)
  const text = await extractPdfText(buf)
  const result = parseEtsKeyPdfText(text)

  const parsed = new Set(result.questions.map((q) => q.number))
  const missing: number[] = []
  for (let n = 101; n <= 200; n++) {
    if (!parsed.has(n)) missing.push(n)
  }

  console.log('text length:', text.length)
  console.log('questions parsed:', result.questions.length)
  console.log('passages parsed:', result.passages.length)
  console.log(
    'passages empty:',
    result.passages.filter((p) => !p.contentEn.trim()).length,
  )
  console.log('missing count:', missing.length)
  console.log('missing nums:', missing.join(', '))
  console.log('\nPassages:')
  for (const p of result.passages) {
    console.log(`- ${p.label}: ${p.contentEn.length} chars`)
  }
  console.log('\nWarnings:')
  for (const w of result.warnings) console.log('-', w)

  if (process.env.DEBUG === '1') {
    for (const num of [131, 135, 150, 151, 199, 200]) {
      const idx = text.search(new RegExp(`\\n\\s*${num}\\.?\\s`))
      console.log(`\n--- raw around ${num} (idx=${idx}) ---`)
      console.log(text.slice(Math.max(0, idx), idx + 700))
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
