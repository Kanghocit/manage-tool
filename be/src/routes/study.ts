import express from 'express'
import { z } from 'zod'

import {
  applyReviewAction,
  buildReviewQueue,
  createUserList,
  createUserWord,
  deleteList,
  deleteWord,
  enrollList,
  getManageLists,
  getStudyDashboard,
  getStudyListDetail,
  unenrollList,
  updateListMeta,
  updateStudySettings,
  updateWord,
  bulkImportWordsFromPaste,
} from '../lib/studyService'
import { parseVocabularyPaste } from '../lib/parseVocabularyPaste'
import { checkAnswer } from '../lib/studySrs'
import { requireAuth, requireRole } from '../middleware/auth'
import { requireExistingUser } from '../middleware/requireExistingUser'
import { caseStudyRouter } from './caseStudy'

export const studyRouter = express.Router()
studyRouter.use(requireAuth, requireExistingUser, requireRole('admin'))
studyRouter.use(caseStudyRouter)

studyRouter.get('/dashboard', async (req, res, next) => {
  try {
    const data = await getStudyDashboard(req.auth!.userId)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

studyRouter.get('/lists/:listId', async (req, res, next) => {
  try {
    const data = await getStudyListDetail(req.auth!.userId, req.params.listId)
    if (!data) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'List not found.' })
    }
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

studyRouter.post('/lists/:listId/enroll', async (req, res, next) => {
  try {
    await enrollList(req.auth!.userId, req.params.listId)
    res.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'LIST_NOT_FOUND') {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'List not found.' })
    }
    next(err)
  }
})

studyRouter.delete('/lists/:listId/enroll', async (req, res, next) => {
  try {
    await unenrollList(req.auth!.userId, req.params.listId)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

studyRouter.get('/lists/:listId/review-queue', async (req, res, next) => {
  try {
    const data = await buildReviewQueue(req.auth!.userId, req.params.listId)
    if (!data) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'List not found.' })
    }
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

const reviewActionSchema = z.object({
  wordId: z.string().min(1),
  action: z.enum(['correct', 'wrong', 'skip', 'known']),
})

studyRouter.post('/lists/:listId/review', async (req, res, next) => {
  try {
    const parsed = reviewActionSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid body.' })
    }
    const progress = await applyReviewAction(
      req.auth!.userId,
      req.params.listId,
      parsed.data.wordId,
      parsed.data.action,
    )
    res.json({ success: true, progress })
  } catch (err) {
    next(err)
  }
})

const checkAnswerSchema = z.object({
  input: z.string(),
  expected: z.string(),
})

studyRouter.post('/check-answer', (req, res) => {
  const parsed = checkAnswerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid body.' })
  }
  res.json({ success: true, correct: checkAnswer(parsed.data.input, parsed.data.expected) })
})

const settingsSchema = z.object({
  dailyNewWords: z.number().int().min(1).max(200).optional(),
  showAllLearned: z.boolean().optional(),
})

studyRouter.patch('/settings', async (req, res, next) => {
  try {
    const parsed = settingsSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid body.' })
    }
    const settings = await updateStudySettings(req.auth!.userId, parsed.data)
    res.json({ success: true, settings })
  } catch (err) {
    next(err)
  }
})

studyRouter.get('/manage/lists', async (req, res, next) => {
  try {
    const lists = await getManageLists(req.auth!.userId)
    res.json({ success: true, lists })
  } catch (err) {
    next(err)
  }
})

const createListSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
})

studyRouter.post('/manage/lists', async (req, res, next) => {
  try {
    const parsed = createListSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid body.' })
    }
    const list = await createUserList(
      req.auth!.userId,
      parsed.data.title,
      parsed.data.description ?? '',
    )
    res.status(201).json({ success: true, list })
  } catch (err) {
    next(err)
  }
})

const updateListSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
})

studyRouter.patch('/manage/lists/:listId', async (req, res, next) => {
  try {
    const parsed = updateListSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid body.' })
    }
    await updateListMeta(req.auth!.userId, req.params.listId, parsed.data)
    res.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'LIST_NOT_FOUND') {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'List not found.' })
    }
    next(err)
  }
})

studyRouter.delete('/manage/lists/:listId', async (req, res, next) => {
  try {
    const result = await deleteList(req.auth!.userId, req.params.listId)
    res.json({
      success: true,
      mode: result.mode,
      message:
        result.mode === 'deleted'
          ? 'Đã xoá list.'
          : 'Đã ẩn list hệ thống khỏi danh sách của bạn.',
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'LIST_NOT_FOUND') {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'List not found.' })
    }
    next(err)
  }
})

const wordSchema = z.object({
  word: z.string().min(1),
  pos: z.string().min(1),
  ipa: z.string().optional(),
  definitionVi: z.string().min(1),
  definitionEn: z.string().min(1),
  examples: z.array(z.object({ en: z.string().min(1), vi: z.string().min(1) })).min(1),
  imageEmoji: z.string().optional(),
})

const importPasteSchema = z.object({
  rawText: z.string().min(1),
})

studyRouter.post('/manage/lists/:listId/words/parse-preview', (req, res) => {
  const parsed = importPasteSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid body.' })
  }
  const result = parseVocabularyPaste(parsed.data.rawText)
  res.json({ success: true, ...result })
})

studyRouter.post('/manage/lists/:listId/words/import-paste', async (req, res, next) => {
  try {
    const parsed = importPasteSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid body.' })
    }
    const result = await bulkImportWordsFromPaste(req.auth!.userId, req.params.listId, parsed.data.rawText)
    res.status(201).json({ success: true, ...result })
  } catch (err) {
    if (err instanceof Error && err.message === 'LIST_NOT_FOUND') {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'List not found.' })
    }
    if (err instanceof Error && err.message === 'PARSE_FAILED') {
      return res.status(400).json({ success: false, code: 'PARSE_FAILED', message: 'Không parse được nội dung.' })
    }
    next(err)
  }
})

studyRouter.post('/manage/lists/:listId/words', async (req, res, next) => {
  try {
    const parsed = wordSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid body.' })
    }
    const word = await createUserWord(req.auth!.userId, req.params.listId, {
      ...parsed.data,
      ipa: parsed.data.ipa ?? '',
      imageEmoji: parsed.data.imageEmoji ?? '📖',
    })
    res.status(201).json({ success: true, word })
  } catch (err) {
    if (err instanceof Error && err.message === 'LIST_NOT_FOUND') {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'List not found.' })
    }
    next(err)
  }
})

studyRouter.patch('/manage/lists/:listId/words/:wordId', async (req, res, next) => {
  try {
    const parsed = wordSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid body.' })
    }
    const word = await updateWord(req.auth!.userId, req.params.listId, req.params.wordId, parsed.data)
    res.json({ success: true, word })
  } catch (err) {
    if (err instanceof Error && err.message === 'WORD_NOT_FOUND') {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Word not found.' })
    }
    next(err)
  }
})

studyRouter.delete('/manage/lists/:listId/words/:wordId', async (req, res, next) => {
  try {
    await deleteWord(req.auth!.userId, req.params.listId, req.params.wordId)
    res.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'WORD_NOT_FOUND') {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Word not found.' })
    }
    next(err)
  }
})
