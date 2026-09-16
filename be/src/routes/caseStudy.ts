import { randomUUID } from 'crypto'

import express from 'express'
import { z } from 'zod'

import { bookletRasterizerErrorMessage, rasterizeBookletPdf } from '../lib/caseStudyBookletRasterizer'
import { parseCaseStudyPdf } from '../lib/caseStudyParser'
import {
  checkCaseQuestion,
  createCaseSetFromPreview,
  deleteCaseSet,
  getCaseSetForManage,
  getCaseSetForPractice,
  listManageCaseSets,
  listPublishedCaseSets,
  readImportPreviewPage,
  readManageSetPage,
  readPracticeSetPage,
  updateCaseAttemptProgress,
  updateCaseSet,
} from '../lib/caseStudyService'
import { cleanupExpiredImportSessions } from '../lib/caseStudyStorage'
import { requireRole } from '../middleware/auth'
import { pdfFieldsUpload, pdfUpload } from '../middleware/upload'

export const caseStudyRouter = express.Router()

const adminOnly = [requireRole('admin')]

function routeParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value
}

function parsePageIndex(raw: string): number | null {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

void cleanupExpiredImportSessions()

caseStudyRouter.get('/cases', async (_req, res, next) => {
  try {
    const sets = await listPublishedCaseSets()
    res.json({ success: true, sets })
  } catch (err) {
    next(err)
  }
})

caseStudyRouter.get('/cases/:setId', async (req, res, next) => {
  try {
    const data = await getCaseSetForPractice(req.auth!.userId, routeParam(req.params.setId))
    if (!data) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Case set not found.' })
    }
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

caseStudyRouter.get('/cases/:setId/pages/:pageIndex', async (req, res, next) => {
  try {
    const pageIndex = parsePageIndex(routeParam(req.params.pageIndex))
    if (pageIndex === null) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid page index.' })
    }
    const file = await readPracticeSetPage(routeParam(req.params.setId), pageIndex)
    if (!file) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Page not found.' })
    }
    res.setHeader('Content-Type', file.mimeType)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.send(file.buffer)
  } catch (err) {
    next(err)
  }
})

const checkSchema = z.object({
  chosenKey: z.enum(['A', 'B', 'C', 'D']),
})

caseStudyRouter.post('/cases/:setId/questions/:questionId/check', async (req, res, next) => {
  try {
    const parsed = checkSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid body.' })
    }
    const result = await checkCaseQuestion(
      req.auth!.userId,
      routeParam(req.params.setId),
      routeParam(req.params.questionId),
      parsed.data.chosenKey,
    )
    if (!result) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Question not found.' })
    }
    res.json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
})

const progressSchema = z.object({
  currentIndex: z.number().int().min(0),
  completed: z.boolean().optional(),
})

caseStudyRouter.patch('/cases/:setId/progress', async (req, res, next) => {
  try {
    const parsed = progressSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid body.' })
    }
    await updateCaseAttemptProgress(
      req.auth!.userId,
      routeParam(req.params.setId),
      parsed.data.currentIndex,
      parsed.data.completed,
    )
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

caseStudyRouter.get('/manage/cases', ...adminOnly, async (_req, res, next) => {
  try {
    const sets = await listManageCaseSets()
    res.json({ success: true, sets })
  } catch (err) {
    next(err)
  }
})

caseStudyRouter.get(
  '/manage/cases/parse-preview/:sessionId/pages/:pageIndex',
  ...adminOnly,
  async (req, res, next) => {
    try {
      const pageIndex = parsePageIndex(routeParam(req.params.pageIndex))
      if (pageIndex === null) {
        return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid page index.' })
      }
      const file = await readImportPreviewPage(routeParam(req.params.sessionId), pageIndex)
      if (!file) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Preview page not found.' })
      }
      res.setHeader('Content-Type', file.mimeType)
      res.setHeader('Cache-Control', 'no-store')
      res.send(file.buffer)
    } catch (err) {
      next(err)
    }
  },
)

caseStudyRouter.get('/manage/cases/:setId', ...adminOnly, async (req, res, next) => {
  try {
    const data = await getCaseSetForManage(routeParam(req.params.setId))
    if (!data) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Case set not found.' })
    }
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

caseStudyRouter.get('/manage/cases/:setId/pages/:pageIndex', ...adminOnly, async (req, res, next) => {
  try {
    const pageIndex = parsePageIndex(routeParam(req.params.pageIndex))
    if (pageIndex === null) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid page index.' })
    }
    const file = await readManageSetPage(routeParam(req.params.setId), pageIndex)
    if (!file) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Page not found.' })
    }
    res.setHeader('Content-Type', file.mimeType)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.send(file.buffer)
  } catch (err) {
    next(err)
  }
})

caseStudyRouter.post('/manage/cases/parse-pdf', ...adminOnly, pdfUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'PDF file required.' })
    }
    const preview = await parseCaseStudyPdf(req.file.buffer)
    res.json({ success: true, preview })
  } catch (err) {
    next(err)
  }
})

caseStudyRouter.post(
  '/manage/cases/parse-pdfs',
  ...adminOnly,
  pdfFieldsUpload,
  async (req, res, next) => {
    try {
      const files = req.files as
        | {
            booklet?: Express.Multer.File[]
            key?: Express.Multer.File[]
          }
        | undefined

      const bookletFile = files?.booklet?.[0]
      const keyFile = files?.key?.[0]

      if (!bookletFile?.buffer) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Booklet PDF required.',
        })
      }
      if (!keyFile?.buffer) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'KEY PDF required.',
        })
      }

      const sessionId = randomUUID()
      let preview
      try {
        preview = await parseCaseStudyPdf(keyFile.buffer)
      } catch (err) {
        return res.status(400).json({
          success: false,
          code: 'KEY_PARSE_FAILED',
          message: err instanceof Error ? err.message : 'Không parse được file KEY.',
        })
      }

      let rasterized
      try {
        rasterized = await rasterizeBookletPdf(bookletFile.buffer, sessionId)
      } catch (err) {
        return res.status(503).json({
          success: false,
          code: 'BOOKLET_RASTERIZE_FAILED',
          message: bookletRasterizerErrorMessage(err),
        })
      }

      res.json({
        success: true,
        preview,
        sessionId,
        bookletPages: rasterized.map((page) => ({
          pageIndex: page.pageIndex,
          url: `/api/study/manage/cases/parse-preview/${sessionId}/pages/${page.pageIndex}`,
        })),
      })
    } catch (err) {
      next(err)
    }
  },
)

const bookletPageSchema = z.object({
  pageIndex: z.number().int().min(0),
  questionFrom: z.number().int().min(0).max(999),
  questionTo: z.number().int().min(0).max(999),
})

const saveSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  sessionId: z.string().uuid().optional(),
  bookletPages: z.array(bookletPageSchema).optional(),
  passages: z.array(
    z.object({
      part: z.union([z.literal(6), z.literal(7)]),
      label: z.string(),
      contentEn: z.string(),
      contentVi: z.string().optional(),
      questionNumbers: z.array(z.number().int()),
    }),
  ),
  questions: z.array(
    z.object({
      part: z.union([z.literal(5), z.literal(6), z.literal(7)]),
      number: z.number().int(),
      stemEn: z.string().min(1),
      options: z.array(z.object({ key: z.string(), textEn: z.string() })).length(4),
      correctKey: z.enum(['A', 'B', 'C', 'D']),
      explanationVi: z.string(),
      passageLabel: z.string().optional(),
    }),
  ),
})

caseStudyRouter.post('/manage/cases', ...adminOnly, async (req, res, next) => {
  try {
    const parsed = saveSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid body.' })
    }
    const setId = await createCaseSetFromPreview(req.auth!.userId, parsed.data)
    res.json({ success: true, setId })
  } catch (err) {
    next(err)
  }
})

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  passages: z
    .array(
      z.object({
        id: z.string().optional(),
        part: z.number().int(),
        label: z.string(),
        contentEn: z.string(),
        contentVi: z.string().optional(),
        sortOrder: z.number().int(),
      }),
    )
    .optional(),
  questions: z
    .array(
      z.object({
        id: z.string().optional(),
        part: z.number().int(),
        number: z.number().int(),
        stemEn: z.string(),
        options: z.array(z.object({ key: z.string(), textEn: z.string() })),
        correctKey: z.string(),
        explanationVi: z.string(),
        passageId: z.string().nullable().optional(),
        sortOrder: z.number().int(),
      }),
    )
    .optional(),
})

caseStudyRouter.patch('/manage/cases/:setId', ...adminOnly, async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid body.' })
    }
    await updateCaseSet(routeParam(req.params.setId), parsed.data)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

caseStudyRouter.delete('/manage/cases/:setId', ...adminOnly, async (req, res, next) => {
  try {
    await deleteCaseSet(routeParam(req.params.setId))
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})
