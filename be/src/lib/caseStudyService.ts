import type { Prisma } from '@prisma/client'

import type {
  CaseStudyParseResult,
  CaseStudyPassagePreview,
  CaseStudyQuestionPreview,
} from './caseStudyParser'
import { isMostlyVietnamese } from './caseStudyParser'
import { prisma } from './prisma'

export type CaseStudyOptionDto = { key: string; textEn: string }

export type CaseStudyPartCounts = { 5: number; 6: number; 7: number }

export type CaseStudySetListItem = {
  id: string
  title: string
  description: string
  status: 'draft' | 'published'
  questionCount: number
  partCounts: CaseStudyPartCounts
  createdAt: string
}

export type CaseStudyPassageDto = {
  id: string
  part: number
  label: string
  contentEn: string
  contentVi?: string
  sortOrder: number
}

function publicPassageContent(contentEn: string): string {
  return isMostlyVietnamese(contentEn) ? '' : contentEn.trim()
}

export type CaseStudyQuestionPublic = {
  id: string
  part: number
  number: number
  stemEn: string
  options: CaseStudyOptionDto[]
  passageId: string | null
  sortOrder: number
}

export type CaseStudySetDetail = {
  set: CaseStudySetListItem
  passages: CaseStudyPassageDto[]
  questions: CaseStudyQuestionPublic[]
  attempt: {
    currentIndex: number
    completed: boolean
    answers: Record<string, { chosenKey: string; correct: boolean }>
  } | null
}

export type CaseStudyManageQuestion = CaseStudyQuestionPublic & {
  correctKey: string
  explanationVi: string
}

export type CaseStudyManageDetail = {
  set: CaseStudySetListItem
  passages: CaseStudyPassageDto[]
  questions: CaseStudyManageQuestion[]
}

function mapOptions(value: Prisma.JsonValue): CaseStudyOptionDto[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is { key: string; textEn: string } => {
      return (
        typeof item === 'object' &&
        item !== null &&
        'key' in item &&
        'textEn' in item &&
        typeof (item as { key: unknown }).key === 'string' &&
        typeof (item as { textEn: unknown }).textEn === 'string'
      )
    })
    .map((item) => ({ key: item.key, textEn: item.textEn }))
}

export type StoredCaseAnswer = {
  chosenKey: string
  correct: boolean
  correctKey: string
  explanationVi: string
}

function parseAttemptAnswers(value: Prisma.JsonValue): Record<string, StoredCaseAnswer> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const out: Record<string, StoredCaseAnswer> = {}
  for (const [questionId, raw] of Object.entries(value)) {
    if (
      typeof raw === 'object' &&
      raw !== null &&
      'chosenKey' in raw &&
      'correct' in raw &&
      typeof (raw as { chosenKey: unknown }).chosenKey === 'string' &&
      typeof (raw as { correct: unknown }).correct === 'boolean'
    ) {
      out[questionId] = {
        chosenKey: (raw as { chosenKey: string }).chosenKey,
        correct: (raw as { correct: boolean }).correct,
        correctKey:
          typeof (raw as { correctKey?: unknown }).correctKey === 'string'
            ? (raw as { correctKey: string }).correctKey
            : (raw as { chosenKey: string }).chosenKey,
        explanationVi:
          typeof (raw as { explanationVi?: unknown }).explanationVi === 'string'
            ? (raw as { explanationVi: string }).explanationVi
            : '',
      }
    }
  }
  return out
}

function emptyPartCounts(): CaseStudyPartCounts {
  return { 5: 0, 6: 0, 7: 0 }
}

function partCountsFromQuestions(questions: { part: number }[]): CaseStudyPartCounts {
  const counts = emptyPartCounts()
  for (const q of questions) {
    if (q.part === 5 || q.part === 6 || q.part === 7) counts[q.part]++
  }
  return counts
}

async function fetchPartCountsBySetIds(setIds: string[]): Promise<Map<string, CaseStudyPartCounts>> {
  const map = new Map<string, CaseStudyPartCounts>()
  if (setIds.length === 0) return map

  const groups = await prisma.caseStudyQuestion.groupBy({
    by: ['setId', 'part'],
    where: { setId: { in: setIds } },
    _count: { _all: true },
  })

  for (const group of groups) {
    if (!map.has(group.setId)) map.set(group.setId, emptyPartCounts())
    const counts = map.get(group.setId)!
    const part = group.part
    if (part === 5 || part === 6 || part === 7) {
      counts[part] = group._count._all
    }
  }

  return map
}

function mapSetListItem(
  row: {
    id: string
    title: string
    description: string
    status: 'draft' | 'published'
    createdAt: Date
    _count: { questions: number }
  },
  partCounts: CaseStudyPartCounts,
): CaseStudySetListItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    questionCount: row._count.questions,
    partCounts,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listPublishedCaseSets(): Promise<CaseStudySetListItem[]> {
  const rows = await prisma.caseStudySet.findMany({
    where: { status: 'published' },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { questions: true } } },
  })
  const partCountsMap = await fetchPartCountsBySetIds(rows.map((row) => row.id))
  return rows.map((row) =>
    mapSetListItem(row, partCountsMap.get(row.id) ?? emptyPartCounts()),
  )
}

export async function listManageCaseSets(): Promise<CaseStudySetListItem[]> {
  const rows = await prisma.caseStudySet.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { questions: true } } },
  })
  const partCountsMap = await fetchPartCountsBySetIds(rows.map((row) => row.id))
  return rows.map((row) =>
    mapSetListItem(row, partCountsMap.get(row.id) ?? emptyPartCounts()),
  )
}

export async function getCaseSetForPractice(userId: string, setId: string): Promise<CaseStudySetDetail | null> {
  const row = await prisma.caseStudySet.findFirst({
    where: { id: setId, status: 'published' },
    include: {
      passages: { orderBy: { sortOrder: 'asc' } },
      questions: { orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!row) return null

  const attempt = await prisma.caseStudyAttempt.findUnique({
    where: { userId_setId: { userId, setId } },
  })

  return {
    set: {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      questionCount: row.questions.length,
      partCounts: partCountsFromQuestions(row.questions),
      createdAt: row.createdAt.toISOString(),
    },
    passages: row.passages.map((p) => ({
      id: p.id,
      part: p.part,
      label: p.label,
      contentEn: publicPassageContent(p.contentEn),
      sortOrder: p.sortOrder,
    })),
    questions: row.questions.map((q) => ({
      id: q.id,
      part: q.part,
      number: q.number,
      stemEn: q.stemEn,
      options: mapOptions(q.options).map((opt) => ({
        key: opt.key,
        textEn: opt.textEn.replace(/\s*\([A-D]\)\s*$/i, '').trim(),
      })),
      passageId: q.passageId,
      sortOrder: q.sortOrder,
    })),
    attempt: attempt
      ? {
          currentIndex: attempt.currentIndex,
          completed: attempt.completed,
          answers: parseAttemptAnswers(attempt.answers),
        }
      : null,
  }
}

export async function getCaseSetForManage(setId: string): Promise<CaseStudyManageDetail | null> {
  const row = await prisma.caseStudySet.findUnique({
    where: { id: setId },
    include: {
      passages: { orderBy: { sortOrder: 'asc' } },
      questions: { orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!row) return null

  return {
    set: {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      questionCount: row.questions.length,
      partCounts: partCountsFromQuestions(row.questions),
      createdAt: row.createdAt.toISOString(),
    },
    passages: row.passages.map((p) => ({
      id: p.id,
      part: p.part,
      label: p.label,
      contentEn: p.contentEn,
      contentVi: p.contentVi,
      sortOrder: p.sortOrder,
    })),
    questions: row.questions.map((q) => ({
      id: q.id,
      part: q.part,
      number: q.number,
      stemEn: q.stemEn,
      options: mapOptions(q.options),
      passageId: q.passageId,
      sortOrder: q.sortOrder,
      correctKey: q.correctKey,
      explanationVi: q.explanationVi,
    })),
  }
}

export async function checkCaseQuestion(
  userId: string,
  setId: string,
  questionId: string,
  chosenKey: string,
) {
  const set = await prisma.caseStudySet.findFirst({
    where: { id: setId, status: 'published' },
  })
  if (!set) return null

  const question = await prisma.caseStudyQuestion.findFirst({
    where: { id: questionId, setId },
  })
  if (!question) return null

  const correct = question.correctKey.toUpperCase() === chosenKey.toUpperCase()

  const existing = await prisma.caseStudyAttempt.findUnique({
    where: { userId_setId: { userId, setId } },
  })

  const answers = existing ? parseAttemptAnswers(existing.answers) : {}
  answers[questionId] = {
    chosenKey: chosenKey.toUpperCase(),
    correct,
    correctKey: question.correctKey,
    explanationVi: question.explanationVi,
  }

  const allQuestions = await prisma.caseStudyQuestion.findMany({
    where: { setId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  })
  const currentIndex = allQuestions.findIndex((q) => q.id === questionId)

  await prisma.caseStudyAttempt.upsert({
    where: { userId_setId: { userId, setId } },
    create: {
      userId,
      setId,
      currentIndex: Math.max(currentIndex, 0),
      completed: Object.keys(answers).length >= allQuestions.length,
      answers,
    },
    update: {
      currentIndex: Math.max(currentIndex, 0),
      completed: Object.keys(answers).length >= allQuestions.length,
      answers,
    },
  })

  return {
    correct,
    correctKey: question.correctKey,
    explanationVi: question.explanationVi,
  }
}

export async function updateCaseAttemptProgress(
  userId: string,
  setId: string,
  currentIndex: number,
  completed?: boolean,
) {
  const existing = await prisma.caseStudyAttempt.findUnique({
    where: { userId_setId: { userId, setId } },
  })
  if (!existing) {
    await prisma.caseStudyAttempt.create({
      data: { userId, setId, currentIndex, completed: completed ?? false },
    })
    return
  }
  await prisma.caseStudyAttempt.update({
    where: { userId_setId: { userId, setId } },
    data: {
      currentIndex,
      ...(completed !== undefined ? { completed } : {}),
    },
  })
}

type SaveCaseSetInput = {
  title: string
  description?: string
  status?: 'draft' | 'published'
  passages: CaseStudyPassagePreview[]
  questions: CaseStudyQuestionPreview[]
}

export async function createCaseSetFromPreview(
  createdById: string,
  input: SaveCaseSetInput,
): Promise<string> {
  const passageKeyToId = new Map<string, string>()

  const set = await prisma.caseStudySet.create({
    data: {
      title: input.title,
      description: input.description ?? '',
      status: input.status ?? 'draft',
      createdById,
    },
  })

  for (let i = 0; i < input.passages.length; i++) {
    const passage = input.passages[i]
    const created = await prisma.caseStudyPassage.create({
      data: {
        setId: set.id,
        part: passage.part,
        label: passage.label,
        contentEn: passage.contentEn,
        contentVi: passage.contentVi ?? '',
        sortOrder: i,
      },
    })
    passageKeyToId.set(passage.label, created.id)
    for (const n of passage.questionNumbers) {
      passageKeyToId.set(`${passage.label}:${n}`, created.id)
    }
  }

  for (let i = 0; i < input.questions.length; i++) {
    const q = input.questions[i]
    let passageId: string | null = null
    if (q.passageLabel) {
      passageId = passageKeyToId.get(q.passageLabel) ?? passageKeyToId.get(`${q.passageLabel}:${q.number}`) ?? null
      if (!passageId) {
        const passage = input.passages.find((p) => p.questionNumbers.includes(q.number))
        if (passage) passageId = passageKeyToId.get(passage.label) ?? null
      }
    }

    await prisma.caseStudyQuestion.create({
      data: {
        setId: set.id,
        passageId,
        part: q.part,
        number: q.number,
        stemEn: q.stemEn,
        options: q.options,
        correctKey: q.correctKey,
        explanationVi: q.explanationVi,
        sortOrder: i,
      },
    })
  }

  return set.id
}

export async function updateCaseSet(
  setId: string,
  patch: {
    title?: string
    description?: string
    status?: 'draft' | 'published'
    passages?: Array<{
      id?: string
      part: number
      label: string
      contentEn: string
      contentVi?: string
      sortOrder: number
    }>
    questions?: Array<{
      id?: string
      part: number
      number: number
      stemEn: string
      options: CaseStudyOptionDto[]
      correctKey: string
      explanationVi: string
      passageId?: string | null
      sortOrder: number
    }>
  },
) {
  if (patch.title !== undefined || patch.description !== undefined || patch.status !== undefined) {
    await prisma.caseStudySet.update({
      where: { id: setId },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
      },
    })
  }

  if (patch.passages) {
    const existingIds = (
      await prisma.caseStudyPassage.findMany({ where: { setId }, select: { id: true } })
    ).map((p) => p.id)
    const incomingIds = patch.passages.map((p) => p.id).filter(Boolean) as string[]
    const toDelete = existingIds.filter((id) => !incomingIds.includes(id))
    if (toDelete.length) {
      await prisma.caseStudyPassage.deleteMany({ where: { id: { in: toDelete } } })
    }
    for (const passage of patch.passages) {
      if (passage.id) {
        await prisma.caseStudyPassage.update({
          where: { id: passage.id },
          data: {
            part: passage.part,
            label: passage.label,
            contentEn: passage.contentEn,
            contentVi: passage.contentVi ?? '',
            sortOrder: passage.sortOrder,
          },
        })
      } else {
        await prisma.caseStudyPassage.create({
          data: {
            setId,
            part: passage.part,
            label: passage.label,
            contentEn: passage.contentEn,
            contentVi: passage.contentVi ?? '',
            sortOrder: passage.sortOrder,
          },
        })
      }
    }
  }

  if (patch.questions) {
    const existingIds = (
      await prisma.caseStudyQuestion.findMany({ where: { setId }, select: { id: true } })
    ).map((q) => q.id)
    const incomingIds = patch.questions.map((q) => q.id).filter(Boolean) as string[]
    const toDelete = existingIds.filter((id) => !incomingIds.includes(id))
    if (toDelete.length) {
      await prisma.caseStudyQuestion.deleteMany({ where: { id: { in: toDelete } } })
    }
    for (const q of patch.questions) {
      const data = {
        setId,
        part: q.part,
        number: q.number,
        stemEn: q.stemEn,
        options: q.options,
        correctKey: q.correctKey,
        explanationVi: q.explanationVi,
        passageId: q.passageId ?? null,
        sortOrder: q.sortOrder,
      }
      if (q.id) {
        await prisma.caseStudyQuestion.update({ where: { id: q.id }, data })
      } else {
        await prisma.caseStudyQuestion.create({ data })
      }
    }
  }
}

export async function deleteCaseSet(setId: string) {
  await prisma.caseStudySet.delete({ where: { id: setId } })
}

export function previewToSaveInput(
  preview: CaseStudyParseResult,
  title?: string,
  description?: string,
  status?: 'draft' | 'published',
): SaveCaseSetInput {
  return {
    title: title ?? preview.title,
    description: description ?? '',
    status: status ?? 'draft',
    passages: preview.passages,
    questions: preview.questions,
  }
}
