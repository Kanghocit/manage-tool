import fs from 'fs/promises'
import path from 'path'
import { createCanvas, type Canvas, type CanvasRenderingContext2D } from 'canvas'

import {
  ensureDir,
  getImportSessionDir,
  pageFileName,
} from './caseStudyStorage'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js') as typeof import('pdfjs-dist')

pdfjs.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js')

/** ~130 DPI for A4-ish pages */
const RENDER_SCALE = 1.75

export type RasterizedPage = {
  pageIndex: number
  storageKey: string
  mimeType: string
}

type CanvasAndContext = {
  canvas: Canvas
  context: CanvasRenderingContext2D
}

class NodeCanvasFactory {
  create(width: number, height: number): CanvasAndContext {
    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d')
    return { canvas, context }
  }

  reset(canvasAndContext: CanvasAndContext, width: number, height: number): void {
    canvasAndContext.canvas.width = width
    canvasAndContext.canvas.height = height
  }

  destroy(canvasAndContext: CanvasAndContext): void {
    canvasAndContext.canvas.width = 0
    canvasAndContext.canvas.height = 0
  }
}

export function bookletRasterizerErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/cannot find module 'canvas'|node canvas|libcairo|libjpeg|libpng/i.test(message)) {
    return 'Server thiếu thư viện canvas để chuyển PDF đề thành ảnh. Cài build deps (libcairo2-dev, libpango1.0-dev, libjpeg-dev) rồi chạy npm install trong thư mục be.'
  }
  if (/Invalid PDF|Missing PDF/i.test(message)) {
    return 'File đề không phải PDF hợp lệ hoặc bị hỏng.'
  }
  return message || 'Không chuyển được PDF đề thành ảnh.'
}

export async function rasterizeBookletPdf(
  buffer: Buffer,
  sessionId: string,
): Promise<RasterizedPage[]> {
  const canvasFactory = new NodeCanvasFactory()
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    canvasFactory,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise

  const outDir = getImportSessionDir(sessionId)
  await ensureDir(outDir)

  const pages: RasterizedPage[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: RENDER_SCALE })
    const canvasAndContext = canvasFactory.create(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    )

    // pdfjs expects browser CanvasRenderingContext2D; node-canvas is compatible at runtime
    await page.render({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvasContext: canvasAndContext.context as any,
      viewport,
    }).promise

    const pageIndex = pageNum - 1
    const storageKey = pageFileName(pageIndex)
    const filePath = path.join(outDir, storageKey)
    const jpeg = canvasAndContext.canvas.toBuffer('image/jpeg', { quality: 0.85 })
    await fs.writeFile(filePath, jpeg)

    pages.push({
      pageIndex,
      storageKey,
      mimeType: 'image/jpeg',
    })

    page.cleanup()
  }

  return pages
}
