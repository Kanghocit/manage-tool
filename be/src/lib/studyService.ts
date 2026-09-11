import type { Prisma, StudyWordStatus } from '@prisma/client'

import { STUDY_VOCABULARY_SEED } from '../data/studyVocabulary'
import { parseVocabularyPaste } from './parseVocabularyPaste'
import { prisma } from './prisma'
import {
  applyCorrect,
  applyKnown,
  applySkip,
  applyWrong,
  isDue,
  type StudyProgressSnapshot,
} from './studySrs'

export type StudyExampleDto = { en: string; vi: string }

export type StudyWordDto = {
  id: string
  word: string
  pos: string
  ipa: string
  definitionVi: string
  definitionEn: string
  examples: StudyExampleDto[]
  imageEmoji: string
  source: 'seed' | 'user'
}

export type StudyListDto = {
  id: string
  title: string
  description: string
  source: 'seed' | 'user'
  wordCount: number
  stats?: ListStatsDto
}

export type ListStatsDto = {
  total: number
  learned: number
  mastered: number
  due: number
}

export type WordProgressDto = {
  wordId: string
  listId: string
  status: StudyWordStatus
  intervalDays: number
  easiness: number
  repetitions: number
  nextReviewAt: string | null
  lastReviewedAt: string | null
  correctCount: number
  wrongCount: number
}

export type DashboardDto = {
  lists: StudyListDto[]
  globalStats: ListStatsDto
  activity: Record<string, number>
  settings: { dailyNewWords: number; showAllLearned: boolean }
  enrolledListIds: string[]
}

type UserContext = {
  hiddenListIds: Set<string>
  hiddenWordKeys: Set<string>
  wordOverrides: Map<string, Prisma.StudyWordOverrideGetPayload<object>>
  metaOverrides: Map<string, Prisma.StudyListMetaOverrideGetPayload<object>>
  userWordsByList: Map<string, StudyWordDto[]>
}

function wordKey(listId: string, wordId: string) {
  return `${listId}:${wordId}`
}

function parseExamples(value: Prisma.JsonValue): StudyExampleDto[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      if (typeof row.en !== 'string' || typeof row.vi !== 'string') return null
      return { en: row.en, vi: row.vi }
    })
    .filter((item): item is StudyExampleDto => item !== null)
}

export async function ensureStudySeed() {
  for (const list of STUDY_VOCABULARY_SEED) {
    await prisma.studyWordList.upsert({
      where: { id: list.id },
      create: {
        id: list.id,
        title: list.title,
        description: list.description,
        words: {
          create: list.words.map((w) => ({
            id: w.id,
            word: w.word,
            pos: w.pos,
            ipa: w.ipa,
            definitionVi: w.definitionVi,
            definitionEn: w.definitionEn,
            examples: w.examples,
            imageEmoji: w.imageEmoji,
            sortOrder: w.sortOrder,
          })),
        },
      },
      update: {
        title: list.title,
        description: list.description,
      },
    })
  }
}

async function loadUserContext(userId: string): Promise<UserContext> {
  const [hiddenLists, hiddenWords, wordOverrides, metaOverrides, userWords] = await Promise.all([
    prisma.studyHiddenList.findMany({ where: { userId } }),
    prisma.studyHiddenWord.findMany({ where: { userId } }),
    prisma.studyWordOverride.findMany({ where: { userId } }),
    prisma.studyListMetaOverride.findMany({ where: { userId } }),
    prisma.studyUserWord.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
  ])

  const userWordsByList = new Map<string, StudyWordDto[]>()
  for (const w of userWords) {
    const bucket = userWordsByList.get(w.listId) ?? []
    bucket.push({
      id: w.id,
      word: w.word,
      pos: w.pos,
      ipa: w.ipa,
      definitionVi: w.definitionVi,
      definitionEn: w.definitionEn,
      examples: parseExamples(w.examples),
      imageEmoji: w.imageEmoji,
      source: 'user',
    })
    userWordsByList.set(w.listId, bucket)
  }

  return {
    hiddenListIds: new Set(hiddenLists.map((h) => h.listId)),
    hiddenWordKeys: new Set(hiddenWords.map((h) => wordKey(h.listId, h.wordId))),
    wordOverrides: new Map(wordOverrides.map((o) => [o.wordId, o])),
    metaOverrides: new Map(metaOverrides.map((o) => [o.listId, o])),
    userWordsByList,
  }
}

function mapSeedWord(w: {
  id: string
  word: string
  pos: string
  ipa: string
  definitionVi: string
  definitionEn: string
  examples: Prisma.JsonValue
  imageEmoji: string
}): StudyWordDto {
  return {
    id: w.id,
    word: w.word,
    pos: w.pos,
    ipa: w.ipa,
    definitionVi: w.definitionVi,
    definitionEn: w.definitionEn,
    examples: parseExamples(w.examples),
    imageEmoji: w.imageEmoji,
    source: 'seed',
  }
}

function applyWordOverride(base: StudyWordDto, override: Prisma.StudyWordOverrideGetPayload<object>): StudyWordDto {
  return {
    ...base,
    word: override.word,
    pos: override.pos,
    ipa: override.ipa,
    definitionVi: override.definitionVi,
    definitionEn: override.definitionEn,
    examples: parseExamples(override.examples),
    imageEmoji: override.imageEmoji,
  }
}

export async function getMergedWordsForList(
  userId: string,
  listId: string,
  ctx?: UserContext,
): Promise<StudyWordDto[]> {
  const context = ctx ?? (await loadUserContext(userId))
  const list = await prisma.studyWordList.findUnique({
    where: { id: listId },
    include: { words: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!list) return []

  const seedWords = list.words
    .filter((w) => !context.hiddenWordKeys.has(wordKey(listId, w.id)))
    .map((w) => {
      const base = mapSeedWord(w)
      const override = context.wordOverrides.get(w.id)
      return override ? applyWordOverride(base, override) : base
    })

  const userWords = context.userWordsByList.get(listId) ?? []
  return [...seedWords, ...userWords]
}

async function getVisibleLists(userId: string, ctx?: UserContext) {
  const context = ctx ?? (await loadUserContext(userId))
  const lists = await prisma.studyWordList.findMany({
    where: {
      OR: [{ userId: null }, { userId }],
      NOT: { id: { in: [...context.hiddenListIds] } },
    },
    include: { words: true },
    orderBy: { createdAt: 'asc' },
  })

  return lists.map((list) => {
    const meta = context.metaOverrides.get(list.id)
    const userExtra = context.userWordsByList.get(list.id)?.length ?? 0
    const hiddenInList = [...context.hiddenWordKeys].filter((k) => k.startsWith(`${list.id}:`)).length
    const wordCount = list.userId
      ? list.words.length + userExtra
      : list.words.length - hiddenInList + userExtra

    return {
      id: list.id,
      title: meta?.title ?? list.title,
      description: meta?.description ?? list.description,
      source: list.userId ? ('user' as const) : ('seed' as const),
      wordCount: Math.max(0, wordCount),
    }
  })
}

async function getOrCreateSettings(userId: string) {
  return prisma.studyUserSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })
}

async function getProgressMap(userId: string, listId?: string) {
  const rows = await prisma.studyWordProgress.findMany({
    where: { userId, ...(listId ? { listId } : {}) },
  })
  return new Map(rows.map((r) => [wordKey(r.listId, r.wordId), r]))
}

function computeListStats(
  listId: string,
  words: StudyWordDto[],
  progressMap: Map<string, { status: StudyWordStatus; nextReviewAt: Date | null }>,
): ListStatsDto {
  let learned = 0
  let mastered = 0
  let due = 0

  for (const w of words) {
    const progress = progressMap.get(wordKey(listId, w.id))
    if (!progress || progress.status === 'new') continue
    learned += 1
    if (progress.status === 'mastered') mastered += 1
    if (isDue(progress.nextReviewAt, progress.status)) due += 1
  }

  return { total: words.length, learned, mastered, due }
}

async function computeListStatsFor(userId: string, listId: string, ctx?: UserContext): Promise<ListStatsDto> {
  const words = await getMergedWordsForList(userId, listId, ctx)
  const progressMap = await getProgressMap(userId, listId)
  return computeListStats(
    listId,
    words,
    new Map(
      [...progressMap.entries()].map(([k, v]) => [
        k,
        { status: v.status, nextReviewAt: v.nextReviewAt },
      ]),
    ),
  )
}

export async function getStudyDashboard(userId: string): Promise<DashboardDto> {
  await ensureStudySeed()
  const ctx = await loadUserContext(userId)
  const settings = await getOrCreateSettings(userId)
  const lists = await getVisibleLists(userId, ctx)

  let enrollments = await prisma.studyListEnrollment.findMany({ where: { userId } })
  if (enrollments.length === 0) {
    const seedIds = lists.filter((l) => l.source === 'seed').map((l) => l.id)
    if (seedIds.length) {
      await prisma.studyListEnrollment.createMany({
        data: seedIds.map((listId) => ({ userId, listId })),
        skipDuplicates: true,
      })
      enrollments = await prisma.studyListEnrollment.findMany({ where: { userId } })
    }
  }

  const enrolledSet = new Set(enrollments.map((e) => e.listId))
  const listsWithStats = await Promise.all(
    lists.map(async (list) => ({
      ...list,
      stats: await computeListStatsFor(userId, list.id, ctx),
    })),
  )

  const globalStats = listsWithStats
    .filter((l) => enrolledSet.has(l.id))
    .reduce(
      (acc, l) => ({
        total: acc.total + (l.stats?.total ?? 0),
        learned: acc.learned + (l.stats?.learned ?? 0),
        mastered: acc.mastered + (l.stats?.mastered ?? 0),
        due: acc.due + (l.stats?.due ?? 0),
      }),
      { total: 0, learned: 0, mastered: 0, due: 0 },
    )

  const activityRows = await prisma.studyDailyActivity.findMany({
    where: { userId },
    orderBy: { activityDate: 'desc' },
    take: 84,
  })

  const activity: Record<string, number> = {}
  for (const row of activityRows) {
    activity[row.activityDate.toISOString().slice(0, 10)] = row.reviewCount
  }

  return {
    lists: listsWithStats,
    globalStats,
    activity,
    settings: {
      dailyNewWords: settings.dailyNewWords,
      showAllLearned: settings.showAllLearned,
    },
    enrolledListIds: [...enrolledSet],
  }
}

export async function getStudyListDetail(userId: string, listId: string) {
  await ensureStudySeed()
  const ctx = await loadUserContext(userId)
  const lists = await getVisibleLists(userId, ctx)
  const list = lists.find((l) => l.id === listId)
  if (!list) return null

  const words = await getMergedWordsForList(userId, listId, ctx)
  const progressRows = await prisma.studyWordProgress.findMany({
    where: { userId, listId },
  })
  const progress: WordProgressDto[] = progressRows.map((p) => ({
    wordId: p.wordId,
    listId: p.listId,
    status: p.status,
    intervalDays: p.intervalDays,
    easiness: p.easiness,
    repetitions: p.repetitions,
    nextReviewAt: p.nextReviewAt?.toISOString() ?? null,
    lastReviewedAt: p.lastReviewedAt?.toISOString() ?? null,
    correctCount: p.correctCount,
    wrongCount: p.wrongCount,
  }))

  const enrolled = await prisma.studyListEnrollment.findUnique({
    where: { userId_listId: { userId, listId } },
  })

  return {
    list: { ...list, stats: await computeListStatsFor(userId, listId, ctx) },
    words,
    progress,
    enrolled: Boolean(enrolled),
  }
}

export async function enrollList(userId: string, listId: string) {
  await ensureStudySeed()
  const list = await prisma.studyWordList.findUnique({ where: { id: listId } })
  if (!list || (list.userId && list.userId !== userId)) {
    throw new Error('LIST_NOT_FOUND')
  }
  await prisma.studyHiddenList.deleteMany({ where: { userId, listId } })
  await prisma.studyListEnrollment.upsert({
    where: { userId_listId: { userId, listId } },
    create: { userId, listId },
    update: {},
  })
}

export async function unenrollList(userId: string, listId: string) {
  await prisma.studyListEnrollment.deleteMany({ where: { userId, listId } })
}

export async function updateStudySettings(
  userId: string,
  patch: { dailyNewWords?: number; showAllLearned?: boolean },
) {
  return prisma.studyUserSettings.upsert({
    where: { userId },
    create: {
      userId,
      dailyNewWords: patch.dailyNewWords ?? 30,
      showAllLearned: patch.showAllLearned ?? true,
    },
    update: patch,
  })
}

async function bumpActivity(userId: string) {
  const today = new Date()
  const activityDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  await prisma.studyDailyActivity.upsert({
    where: { userId_activityDate: { userId, activityDate } },
    create: { userId, activityDate, reviewCount: 1 },
    update: { reviewCount: { increment: 1 } },
  })
}

async function getDefaultProgress(userId: string, listId: string, wordId: string): Promise<StudyProgressSnapshot> {
  const existing = await prisma.studyWordProgress.findUnique({
    where: { userId_listId_wordId: { userId, listId, wordId } },
  })
  if (existing) {
    return {
      status: existing.status,
      intervalDays: existing.intervalDays,
      easiness: existing.easiness,
      repetitions: existing.repetitions,
      nextReviewAt: existing.nextReviewAt,
      lastReviewedAt: existing.lastReviewedAt,
      correctCount: existing.correctCount,
      wrongCount: existing.wrongCount,
    }
  }
  return {
    status: 'new',
    intervalDays: 0,
    easiness: 2.5,
    repetitions: 0,
    nextReviewAt: null,
    lastReviewedAt: null,
    correctCount: 0,
    wrongCount: 0,
  }
}

export async function buildReviewQueue(userId: string, listId: string) {
  const detail = await getStudyListDetail(userId, listId)
  if (!detail) return null

  const settings = await getOrCreateSettings(userId)
  const progressMap = new Map(detail.progress.map((p) => [p.wordId, p]))
  const todayStart = Date.now()

  const due: StudyWordDto[] = []
  const learning: StudyWordDto[] = []
  const fresh: StudyWordDto[] = []

  for (const word of detail.words) {
    const p = progressMap.get(word.id)
    const status = p?.status ?? 'new'
    if (status === 'new') {
      fresh.push(word)
      continue
    }
    if (status === 'learning') {
      learning.push(word)
      continue
    }
    const next = p?.nextReviewAt ? new Date(p.nextReviewAt).getTime() : 0
    if (!next || next <= todayStart) due.push(word)
  }

  const newLimit = settings.dailyNewWords
  const queue = [...due, ...learning, ...fresh.slice(0, newLimit)]
  return { queue, settings: { dailyNewWords: settings.dailyNewWords } }
}

export async function applyReviewAction(
  userId: string,
  listId: string,
  wordId: string,
  action: 'correct' | 'wrong' | 'skip' | 'known',
) {
  const current = await getDefaultProgress(userId, listId, wordId)
  let next: StudyProgressSnapshot
  switch (action) {
    case 'correct':
      next = applyCorrect(current)
      break
    case 'wrong':
      next = applyWrong(current)
      break
    case 'known':
      next = applyKnown(current)
      break
    case 'skip':
      next = applySkip(current)
      break
  }

  await prisma.studyWordProgress.upsert({
    where: { userId_listId_wordId: { userId, listId, wordId } },
    create: {
      userId,
      listId,
      wordId,
      ...next,
    },
    update: next,
  })

  if (action === 'correct' || action === 'wrong' || action === 'known') {
    await bumpActivity(userId)
  }

  return next
}

export async function createUserList(userId: string, title: string, description: string) {
  const id = `list-${Date.now()}`
  const list = await prisma.studyWordList.create({
    data: { id, userId, title, description },
  })
  await prisma.studyListEnrollment.create({ data: { userId, listId: id } })
  return list
}

export async function updateListMeta(
  userId: string,
  listId: string,
  patch: { title?: string; description?: string },
) {
  const list = await prisma.studyWordList.findUnique({ where: { id: listId } })
  if (!list) throw new Error('LIST_NOT_FOUND')
  if (list.userId) {
    return prisma.studyWordList.update({
      where: { id: listId },
      data: {
        title: patch.title ?? list.title,
        description: patch.description ?? list.description,
      },
    })
  }
  return prisma.studyListMetaOverride.upsert({
    where: { userId_listId: { userId, listId } },
    create: {
      userId,
      listId,
      title: patch.title,
      description: patch.description,
    },
    update: patch,
  })
}

export async function deleteList(userId: string, listId: string) {
  const list = await prisma.studyWordList.findUnique({ where: { id: listId } })
  if (!list) throw new Error('LIST_NOT_FOUND')

  // User-owned list — hard delete
  if (list.userId === userId) {
    await prisma.$transaction([
      prisma.studyWordProgress.deleteMany({ where: { userId, listId } }),
      prisma.studyListEnrollment.deleteMany({ where: { userId, listId } }),
      prisma.studyUserWord.deleteMany({ where: { userId, listId } }),
      prisma.studyWordList.delete({ where: { id: listId } }),
    ])
    return { mode: 'deleted' as const }
  }

  // Seed / system list — soft hide for this user
  await prisma.$transaction([
    prisma.studyWordProgress.deleteMany({ where: { userId, listId } }),
    prisma.studyUserWord.deleteMany({ where: { userId, listId } }),
    prisma.studyWordOverride.deleteMany({ where: { userId, listId } }),
    prisma.studyListMetaOverride.deleteMany({ where: { userId, listId } }),
    prisma.studyHiddenWord.deleteMany({ where: { userId, listId } }),
    prisma.studyListEnrollment.deleteMany({ where: { userId, listId } }),
    prisma.studyHiddenList.upsert({
      where: { userId_listId: { userId, listId } },
      create: { userId, listId },
      update: {},
    }),
  ])
  return { mode: 'hidden' as const }
}

export async function createUserWord(
  userId: string,
  listId: string,
  data: Omit<StudyWordDto, 'id' | 'source'>,
) {
  const list = await prisma.studyWordList.findUnique({ where: { id: listId } })
  if (!list) throw new Error('LIST_NOT_FOUND')
  if (list.userId && list.userId !== userId) throw new Error('FORBIDDEN')

  if (list.userId) {
    const maxOrder = await prisma.studyWord.aggregate({
      where: { listId },
      _max: { sortOrder: true },
    })
    const word = await prisma.studyWord.create({
      data: {
        id: `w-${Date.now()}`,
        listId,
        word: data.word,
        pos: data.pos,
        ipa: data.ipa,
        definitionVi: data.definitionVi,
        definitionEn: data.definitionEn,
        examples: data.examples,
        imageEmoji: data.imageEmoji,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    })
    return mapSeedWord(word)
  }

  const maxOrder = await prisma.studyUserWord.aggregate({
    where: { userId, listId },
    _max: { sortOrder: true },
  })
  const word = await prisma.studyUserWord.create({
    data: {
      userId,
      listId,
      word: data.word,
      pos: data.pos,
      ipa: data.ipa,
      definitionVi: data.definitionVi,
      definitionEn: data.definitionEn,
      examples: data.examples,
      imageEmoji: data.imageEmoji,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  })
  return {
    id: word.id,
    word: word.word,
    pos: word.pos,
    ipa: word.ipa,
    definitionVi: word.definitionVi,
    definitionEn: word.definitionEn,
    examples: parseExamples(word.examples),
    imageEmoji: word.imageEmoji,
    source: 'user' as const,
  }
}

export async function updateWord(
  userId: string,
  listId: string,
  wordId: string,
  data: Partial<Omit<StudyWordDto, 'id' | 'source'>>,
) {
  const list = await prisma.studyWordList.findUnique({ where: { id: listId } })
  if (!list) throw new Error('LIST_NOT_FOUND')

  const userWord = await prisma.studyUserWord.findFirst({
    where: { id: wordId, userId, listId },
  })
  if (userWord) {
    const updated = await prisma.studyUserWord.update({
      where: { id: wordId },
      data,
    })
    return {
      id: updated.id,
      word: updated.word,
      pos: updated.pos,
      ipa: updated.ipa,
      definitionVi: updated.definitionVi,
      definitionEn: updated.definitionEn,
      examples: parseExamples(updated.examples),
      imageEmoji: updated.imageEmoji,
      source: 'user' as const,
    }
  }

  if (list.userId === userId) {
    const updated = await prisma.studyWord.update({
      where: { id: wordId },
      data,
    })
    return mapSeedWord(updated)
  }

  const seedWord = await prisma.studyWord.findUnique({ where: { id: wordId } })
  if (!seedWord || seedWord.listId !== listId) throw new Error('WORD_NOT_FOUND')

  const examplesValue = (data.examples ?? parseExamples(seedWord.examples)) as Prisma.InputJsonValue
  const updateData: Prisma.StudyWordOverrideUpdateInput = {
    ...(data.word !== undefined ? { word: data.word } : {}),
    ...(data.pos !== undefined ? { pos: data.pos } : {}),
    ...(data.ipa !== undefined ? { ipa: data.ipa } : {}),
    ...(data.definitionVi !== undefined ? { definitionVi: data.definitionVi } : {}),
    ...(data.definitionEn !== undefined ? { definitionEn: data.definitionEn } : {}),
    ...(data.examples !== undefined ? { examples: data.examples as Prisma.InputJsonValue } : {}),
    ...(data.imageEmoji !== undefined ? { imageEmoji: data.imageEmoji } : {}),
  }

  const updated = await prisma.studyWordOverride.upsert({
    where: { userId_wordId: { userId, wordId } },
    create: {
      userId,
      wordId,
      listId,
      word: data.word ?? seedWord.word,
      pos: data.pos ?? seedWord.pos,
      ipa: data.ipa ?? seedWord.ipa,
      definitionVi: data.definitionVi ?? seedWord.definitionVi,
      definitionEn: data.definitionEn ?? seedWord.definitionEn,
      examples: examplesValue,
      imageEmoji: data.imageEmoji ?? seedWord.imageEmoji,
    },
    update: updateData,
  })
  return applyWordOverride(mapSeedWord(seedWord), updated)
}

export async function deleteWord(userId: string, listId: string, wordId: string) {
  const userWord = await prisma.studyUserWord.findFirst({
    where: { id: wordId, userId, listId },
  })
  if (userWord) {
    await prisma.studyUserWord.delete({ where: { id: wordId } })
    await prisma.studyWordProgress.deleteMany({ where: { userId, listId, wordId } })
    return
  }

  const list = await prisma.studyWordList.findUnique({ where: { id: listId } })
  if (!list) throw new Error('LIST_NOT_FOUND')
  if (list.userId === userId) {
    await prisma.studyWord.delete({ where: { id: wordId } })
    await prisma.studyWordProgress.deleteMany({ where: { userId, listId, wordId } })
    return
  }

  await prisma.studyHiddenWord.upsert({
    where: { userId_listId_wordId: { userId, listId, wordId } },
    create: { userId, listId, wordId },
    update: {},
  })
  await prisma.studyWordProgress.deleteMany({ where: { userId, listId, wordId } })
  await prisma.studyWordOverride.deleteMany({ where: { userId, wordId } })
}

export async function getManageLists(userId: string) {
  await ensureStudySeed()
  const ctx = await loadUserContext(userId)
  return getVisibleLists(userId, ctx)
}

export async function bulkImportWordsFromPaste(userId: string, listId: string, rawText: string) {
  const parsed = parseVocabularyPaste(rawText)
  if (!parsed.words.length && parsed.errors.length) {
    throw new Error('PARSE_FAILED')
  }

  const imported: StudyWordDto[] = []
  for (const word of parsed.words) {
    imported.push(await createUserWord(userId, listId, word))
  }

  return {
    imported: imported.length,
    words: imported,
    errors: parsed.errors,
  }
}
