import pdf from 'pdf-parse'

export type CaseStudyOptionDto = { key: string; textEn: string }

export type CaseStudyQuestionPreview = {
  part: 5 | 6 | 7
  number: number
  stemEn: string
  options: CaseStudyOptionDto[]
  correctKey: string
  explanationVi: string
  passageLabel?: string
  answerUncertain?: boolean
}

export type CaseStudyPassagePreview = {
  part: 6 | 7
  label: string
  contentEn: string
  contentVi: string
  questionNumbers: number[]
}

export type CaseStudyParseResult = {
  title: string
  passages: CaseStudyPassagePreview[]
  questions: CaseStudyQuestionPreview[]
  warnings: string[]
}

const VI_CHAR = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i
const VI_CHAR_ALL = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/gi

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await pdf(buffer)
  return normalizePdfText(result.text)
}

function normalizePdfText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/–+/g, '-------')
    .replace(/-{3,}/g, '-------')
    .replace(/\n{3,}/g, '\n\n')
}

function stripPageNoise(text: string): string {
  return text
    .replace(/ETS\s+\d+\s+READING\s+TEST/gi, '')
    .replace(/-- \d+ of \d+ --/g, '')
    .replace(/^\d+\s*$/gm, '')
    .replace(/^\tSTT\s+.*$/gm, '')
}

function trimEnglishFragment(text: string): string {
  let t = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
  const cutPatterns = [
    VI_CHAR,
    /\sTa\s/i,
    /\sChọn/i,
    /\sCâu/i,
    /\sMục đích/i,
    /\sDịch:/i,
    /\sUseful Structures:/i,
    /\sPhân tích:/i,
  ]
  let cutAt = t.length
  for (const pattern of cutPatterns) {
    const idx = t.search(pattern)
    if (idx > 0) cutAt = Math.min(cutAt, idx)
  }
  return sanitizeEnglishText(t.slice(0, cutAt))
}

function sanitizeEnglishText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*\([A-D]\)\s*$/i, '')
    .trim()
}

function isFalsePositiveQuestionHit(number: number, slice: string): boolean {
  const head = slice.slice(0, 160)
  if (/^\s*\d{3}\s+(?:đô|Sổ|H3|D1)/i.test(slice)) return true
  if (/\bđô la\b/i.test(head)) return true
  if (/H3-|Sổ bìa|Sail Away \d+/i.test(head)) return true
  if (/^\s*\d{3}\s*\n\s*[A-Z]{1,3}-/m.test(slice.slice(0, 100))) return true
  return false
}

function looksLikeQuestionContent(number: number, slice: string): boolean {
  const body = slice.replace(new RegExp(`^\\s*${number}\\s*[:.]?\\s*`, 'i'), '').trim()
  if (/^\(\s*[A-D]\s*\)/i.test(body)) return true
  if (/^(What|Who|Where|When|Why|How|Which|According|At \d|In |The |Mr\.|Ms\.|Mrs\.)/i.test(body)) {
    return true
  }
  return /\([A-D]\)/i.test(slice.slice(0, 400))
}

function scoreQuestionHit(number: number, slice: string): number {
  if (isFalsePositiveQuestionHit(number, slice)) return -1
  if (!looksLikeQuestionContent(number, slice)) return -1

  let score = 0
  if (/\([A-D]\)/i.test(slice)) score += 3
  if (/Chọn/i.test(slice)) score += 2
  if (/^(What|Who|Where|When|Why|How|Which|According|At \d)/im.test(slice)) score += +2
  if (/^\s*\d{3}\s*\([A-D]\)/m.test(slice.slice(0, 40))) score += 2
  if (/^\s*\d{3}\.\s+(What|Who|Where|When|Why|How|Which|According|At \d)/im.test(slice)) score += 5
  if (/\n\s*[A-D]\s*\n/i.test(slice)) score += 1
  return score
}

function extractCorrectKey(block: string): string | null {
  const patterns = [
    /Chọn\s*\(([A-D])\)/i,
    /Chọn\s+([A-D])\b/i,
    /(?:^|\n)\s*([A-D])\s*\n\s*(?:Điều|Vào|Mục|Công|Cô |Ông |Bà |Darboury|Ms\.|Mr\.|The |What |According)/im,
    /\([A-D]\)[\s\S]{0,1500}?\n\s*([A-D])\s*\n+(?:\n)*[^\x00-\x7F]/i,
    /(?:^|\n)\s*([A-D])\s*\n+(?:\n)*[^\x00-\x7F]/m,
    /(?:^|\n)\s*([A-D])\s*(?:\n|$)/m,
    /(?:^|\n)\s*([A-D])\.\s/m,
  ]
  for (const pattern of patterns) {
    const match = block.match(pattern)
    if (match) return match[1].toUpperCase()
  }
  return null
}

function extractOptions(block: string): CaseStudyOptionDto[] {
  const markers: { key: string; index: number; contentStart: number }[] = []
  const markerRegex = /\(([A-D])\)\s*/gi
  let match: RegExpExecArray | null

  while ((match = markerRegex.exec(block)) !== null) {
    markers.push({
      key: match[1].toUpperCase(),
      index: match.index,
      contentStart: match.index + match[0].length,
    })
  }

  const byKey = new Map<string, string>()
  for (let i = 0; i < markers.length; i++) {
    const current = markers[i]
    if (byKey.has(current.key)) continue
    const end = markers[i + 1]?.index ?? block.length
    const raw = block.slice(current.contentStart, end)
    const textEn = trimEnglishFragment(raw)
    if (textEn) byKey.set(current.key, textEn)
    if (byKey.size >= 4) break
  }

  return (['A', 'B', 'C', 'D'] as const)
    .map((key) => ({ key, textEn: byKey.get(key) ?? '' }))
    .filter((opt) => opt.textEn.length > 0)
}

function extractExplanation(block: string, correctKey: string): string {
  const splitPattern = new RegExp(
    `Chọn\\s*\\(?${correctKey}\\)?|(?:^|\\n)\\s*${correctKey}\\.?\\s*(?:\\n|$)`,
    'im',
  )
  const afterAnswer = block.split(splitPattern)[1]
  if (!afterAnswer) {
    const viStart = block.search(/\n\s*(?:Điều|Vào|Mục|Công|Cô |Ông |Bà |Darboury)/i)
    if (viStart >= 0) return block.slice(viStart).trim()
    return ''
  }
  return afterAnswer
    .replace(/^[\s.)]+/, '')
    .replace(/\n+/g, '\n')
    .replace(/\s+\n/g, '\n')
    .trim()
}

function defaultStem(part: 5 | 6 | 7, number: number): string {
  if (part === 6) return `Select the best answer to complete the text (Question ${number}).`
  return `Question ${number}`
}

function parseQuestionBlock(
  part: 5 | 6 | 7,
  number: number,
  block: string,
  passageLabel?: string,
): CaseStudyQuestionPreview | null {
  const options = extractOptions(block)
  if (options.length < 4) return null

  let correctKey = extractCorrectKey(block)
  let answerUncertain = false
  if (!correctKey) {
    correctKey = 'A'
    answerUncertain = true
  }

  const firstOptionIdx = block.search(/\([A-D]\)/i)
  const header = block.slice(0, firstOptionIdx >= 0 ? firstOptionIdx : block.length)
  let stemEn = header
    .replace(new RegExp(`^\\s*${number}\\s*[:.]?\\s*`, 'i'), '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  stemEn = trimEnglishFragment(stemEn)
  if (!stemEn) stemEn = defaultStem(part, number)

  const explanationVi = extractExplanation(block, correctKey)

  return {
    part,
    number,
    stemEn,
    options: options.slice(0, 4),
    correctKey,
    explanationVi,
    passageLabel,
    ...(answerUncertain ? { answerUncertain: true } : {}),
  }
}

type PassageHeader = { index: number; label: string; from: number; to: number }

const TRIPLE_PASSAGE_RANGES: [number, number][] = [
  [176, 180],
  [181, 185],
  [186, 190],
  [191, 195],
  [196, 200],
]

function normalizePassageLabel(from: number, to: number): string {
  return `Question ${from}-${to}`
}

function findPassageHeaders(text: string): PassageHeader[] {
  const headers: PassageHeader[] = []
  const passageHeaderRegex = /Questions?\s+(\d+)\s*[-–]\s*(\d+)/gi
  let match: RegExpExecArray | null

  while ((match = passageHeaderRegex.exec(text)) !== null) {
    const from = Number(match[1])
    const to = Number(match[2])
    headers.push({
      index: match.index,
      label: normalizePassageLabel(from, to),
      from,
      to,
    })
  }

  return headers.sort((a, b) => a.index - b.index)
}

function findTripleReadingStart(
  text: string,
  from: number,
  to: number,
  qStart: number,
  questionStarts: Map<number, number>,
): number {
  const markerInText = text.slice(0, qStart).search(
    new RegExp(`${from}\\s*[-–]\\s*${to}(?:\\s+tham chiếu|\\s|$)`, 'i'),
  )
  if (markerInText >= 0) return markerInText

  const prevStart = questionStarts.get(from - 1)
  const searchFrom = prevStart !== undefined ? prevStart : Math.max(0, qStart - 6000)
  const window = text.slice(searchFrom, qStart)
  const minOffset = Math.floor(window.length * 0.3)

  const docPatterns = [/—-{2,}/g, /\nNgười nhận:/g, /\nTHÔNG TIN CÔNG BỐ/g]
  let best = -1
  for (const pattern of docPatterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(window)) !== null) {
      if (match.index >= minOffset) {
        best = Math.max(best, searchFrom + match.index)
      }
    }
  }

  if (best >= 0) return best
  return Math.max(searchFrom, qStart - 3500)
}

function buildTriplePassageHeaders(
  text: string,
  tripleHeader: PassageHeader,
  questionStarts: Map<number, number>,
): PassageHeader[] {
  const headers: PassageHeader[] = []
  for (let i = 0; i < TRIPLE_PASSAGE_RANGES.length; i++) {
    const [from, to] = TRIPLE_PASSAGE_RANGES[i]
    const qStart = questionStarts.get(from)
    if (qStart === undefined) continue

    const index =
      i === 0
        ? tripleHeader.index
        : findTripleReadingStart(text, from, to, qStart, questionStarts)

    headers.push({
      index,
      label: normalizePassageLabel(from, to),
      from,
      to,
    })
  }

  return headers
}

function expandTriplePassageHeaders(
  text: string,
  headers: PassageHeader[],
  questionStarts: Map<number, number>,
): PassageHeader[] {
  const tripleIdx = headers.findIndex((h) => h.from === 176 && h.to === 180)
  if (tripleIdx < 0) return headers

  const tripleHeader = headers[tripleIdx]
  const expanded = buildTriplePassageHeaders(text, tripleHeader, questionStarts)
  const before = headers.slice(0, tripleIdx)
  const after = headers.slice(tripleIdx + 1)
  return [...before, ...expanded, ...after].sort((a, b) => a.index - b.index)
}

function findFirstQuestionInChunk(chunk: string, fromNum: number): number {
  const patterns = [
    new RegExp(
      `\\n\\s*${fromNum}\\s*\\.\\s+(?:According|What|Who|Where|When|Why|How|Which|In |At |The |Mr\\.|Ms\\.|Mrs\\.)`,
      'i',
    ),
    new RegExp(
      `\\n\\s*${fromNum}\\s+(?:What|Who|Where|When|Why|How|Which|According|At \\d|In |The |Mr\\.|Ms\\.|Mrs\\.)`,
      'i',
    ),
    new RegExp(`\\n\\s*${fromNum}\\s*\\([A-D]\\)`, 'i'),
  ]
  for (const pattern of patterns) {
    const idx = chunk.search(pattern)
    if (idx >= 0) return idx
  }
  return -1
}

function cleanPassageBody(raw: string): string {
  return raw
    .replace(/\(Dịch\)/gi, '')
    .replace(/Questions?\s+\d+\s*[-–]\s*\d+\s*:?\s*/gi, '')
    .replace(/^\s*[-–—]{2,}\s*$/gm, '')
    .replace(/\(\d{3}\)/g, '_____')
    .replace(/\[\d+\]/g, '_____')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function isMostlyVietnamese(text: string): boolean {
  if (!text.trim()) return false
  const vi = [...text.matchAll(VI_CHAR_ALL)].length
  const latin = (text.match(/[a-zA-Z]/g) || []).length
  return vi > 8 && vi >= latin * 0.12
}

function pickEnglishPassageContent(raw: string): { contentEn: string; contentVi: string } {
  const contentVi = isMostlyVietnamese(raw) ? raw.trim() : ''
  const contentEn = raw && !isMostlyVietnamese(raw) ? raw.trim() : ''
  return { contentEn, contentVi }
}

function extractPassageContent(chunk: string, header: PassageHeader, alreadyBounded = false): string {
  const headerEnd = chunk.search(new RegExp(`${header.from}\\s*[-–]\\s*${header.to}`))
  const afterHeader = headerEnd >= 0 ? chunk.slice(headerEnd) : chunk
  const headerLineEnd = afterHeader.indexOf('\n')
  const bodyStart = headerLineEnd >= 0 ? headerLineEnd + 1 : 0

  let bodyEnd = afterHeader.length
  if (!alreadyBounded) {
    const firstQuestionIdx = findFirstQuestionInChunk(afterHeader, header.from)
    if (firstQuestionIdx > bodyStart) bodyEnd = firstQuestionIdx
  }

  if (bodyEnd <= bodyStart) return ''

  return cleanPassageBody(afterHeader.slice(bodyStart, bodyEnd))
}

function parsePassageSections(
  text: string,
  questionStarts: Map<number, number>,
): CaseStudyPassagePreview[] {
  const headers = expandTriplePassageHeaders(text, findPassageHeaders(text), questionStarts)
  const passages: CaseStudyPassagePreview[] = []

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]
    const nextHeader = headers[i + 1]
    const qStart = questionStarts.get(header.from)
    const nextIndex =
      header.from >= 176 && qStart !== undefined
        ? qStart
        : (nextHeader?.index ?? text.length)

    const chunk = text.slice(header.index, nextIndex)
    const part: 6 | 7 = header.from >= 147 ? 7 : 6
    const bounded = header.from >= 176 && qStart !== undefined
    const rawPassage = extractPassageContent(chunk, header, bounded)

    const questionNumbers: number[] = []
    for (let n = header.from; n <= header.to; n++) questionNumbers.push(n)

    passages.push({
      part,
      label: header.label,
      contentEn: rawPassage,
      contentVi: '',
      questionNumbers,
    })
  }

  return passages
}

function finalizePassageLanguages(passages: CaseStudyPassagePreview[]): void {
  for (const passage of passages) {
    const { contentEn, contentVi } = pickEnglishPassageContent(passage.contentEn)
    passage.contentEn = contentEn
    passage.contentVi = contentVi
  }
}

function splitQuestionsWithIndices(
  text: string,
  minNum: number,
  maxNum: number,
): { blocks: Map<number, string>; starts: Map<number, number> } {
  const blocks = new Map<number, string>()
  const starts = new Map<number, number>()
  const regex = /(?:^|\n)\s*(\d{3})\s*[:.]?\s+/g
  const hits: { number: number; index: number; score: number }[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const number = Number(match[1])
    if (number < minNum || number > maxNum) continue
    const slice = text.slice(match.index, match.index + 900)
    const score = scoreQuestionHit(number, slice)
    if (score < 0) continue
    hits.push({ number, index: match.index, score })
  }

  const bestByNumber = new Map<number, { index: number; score: number }>()
  for (const hit of hits) {
    const prev = bestByNumber.get(hit.number)
    if (!prev || hit.score > prev.score) {
      bestByNumber.set(hit.number, { index: hit.index, score: hit.score })
    }
  }

  const sorted = [...bestByNumber.entries()].sort((a, b) => a[1].index - b[1].index)
  for (let i = 0; i < sorted.length; i++) {
    const [number, meta] = sorted[i]
    const end = sorted[i + 1]?.[1].index ?? text.length
    starts.set(number, meta.index)
    blocks.set(number, text.slice(meta.index, end))
  }

  return { blocks, starts }
}

function splitQuestions(text: string, minNum: number, maxNum: number): Map<number, string> {
  return splitQuestionsWithIndices(text, minNum, maxNum).blocks
}

export function parseEtsKeyPdfText(rawText: string): CaseStudyParseResult {
  const warnings: string[] = []
  const text = stripPageNoise(rawText)

  const titleMatch = text.match(/ETS\s+\d+\s+READING\s+TEST/i)
  const title = titleMatch ? 'TOEIC Reading Test' : 'Case Study Set'

  const part5Idx = text.search(/PART\s*5/i)
  const part6Idx = text.search(/PART\s*6/i)
  const part7Idx = text.search(/PART\s*7/i)

  const part5Text = part6Idx > 0 ? text.slice(part5Idx, part6Idx) : text.slice(part5Idx)
  const part6Text =
    part6Idx > 0 && part7Idx > 0 ? text.slice(part6Idx, part7Idx) : part6Idx > 0 ? text.slice(part6Idx) : ''
  const part7Text = part7Idx > 0 ? text.slice(part7Idx) : ''
  const passageSourceText = part6Idx > 0 ? text.slice(part6Idx) : `${part6Text}\n${part7Text}`

  const part5Split = splitQuestionsWithIndices(part5Text, 101, 130)
  const part6Split = splitQuestionsWithIndices(part6Text, 131, 146)
  const part7Split = splitQuestionsWithIndices(part7Text, 147, 200)
  const passageSplit = splitQuestionsWithIndices(passageSourceText, 131, 200)

  const passages = parsePassageSections(passageSourceText, passageSplit.starts)
  const passageByQuestion = new Map<number, CaseStudyPassagePreview>()
  for (const passage of passages) {
    for (const n of passage.questionNumbers) passageByQuestion.set(n, passage)
  }

  const questions: CaseStudyQuestionPreview[] = []
  const allQuestionBlocks = new Map<number, string>([
    ...part5Split.blocks,
    ...part6Split.blocks,
    ...part7Split.blocks,
  ])

  const ingest = (part: 5 | 6 | 7, blocks: Map<number, string>) => {
    for (const [number, block] of blocks) {
      const passage = passageByQuestion.get(number)
      const q = parseQuestionBlock(part, number, block, passage?.label)
      if (q) {
        questions.push(q)
        if (q.answerUncertain) {
          warnings.push(`Câu ${number}: không tự detect được đáp án — admin chọn thủ công`)
        }
      } else {
        warnings.push(`Không parse được câu Part ${part} số ${number}`)
      }
    }
  }

  ingest(5, part5Split.blocks)
  ingest(6, part6Split.blocks)
  ingest(7, part7Split.blocks)

  questions.sort((a, b) => a.number - b.number)
  finalizePassageLanguages(passages)

  for (const passage of passages) {
    if (!passage.contentEn) {
      warnings.push(
        `${passage.label}: thiếu đoạn đọc tiếng Anh — PDF KEY chỉ có bản dịch; admin cần dán đoạn EN trước khi đăng`,
      )
    }
  }

  const parsedNums = new Set(questions.map((q) => q.number))
  for (let n = 101; n <= 200; n++) {
    if (!parsedNums.has(n)) warnings.push(`Thiếu câu ${n} — kiểm tra PDF hoặc thêm thủ công`)
  }

  if (questions.length === 0) {
    warnings.push('Không trích được câu hỏi nào. Kiểm tra định dạng PDF.')
  }

  return { title, passages, questions, warnings }
}

export async function parseCaseStudyPdf(buffer: Buffer): Promise<CaseStudyParseResult> {
  const parsedText = await extractPdfText(buffer)
  return parseEtsKeyPdfText(parsedText)
}
