import type { StudyWordStatus } from '@prisma/client'

export type StudyProgressSnapshot = {
  status: StudyWordStatus
  intervalDays: number
  easiness: number
  repetitions: number
  nextReviewAt: Date | null
  lastReviewedAt: Date | null
  correctCount: number
  wrongCount: number
}

const INTERVALS = [0, 1, 3, 7, 14, 30, 60]

function todayUtcDate(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

export function applyCorrect(progress: StudyProgressSnapshot): StudyProgressSnapshot {
  const repetitions = progress.repetitions + 1
  const intervalIndex = Math.min(repetitions, INTERVALS.length - 1)
  const intervalDays = INTERVALS[intervalIndex] ?? 60
  const status: StudyWordStatus =
    repetitions >= 4 ? 'mastered' : repetitions >= 2 ? 'review' : 'learning'

  return {
    ...progress,
    status,
    repetitions,
    intervalDays,
    easiness: Math.min(3, progress.easiness + 0.1),
    nextReviewAt: addDays(todayUtcDate(), intervalDays),
    lastReviewedAt: new Date(),
    correctCount: progress.correctCount + 1,
  }
}

export function applyWrong(progress: StudyProgressSnapshot): StudyProgressSnapshot {
  return {
    ...progress,
    status: 'learning',
    repetitions: 0,
    intervalDays: 0,
    easiness: Math.max(1.3, progress.easiness - 0.2),
    nextReviewAt: todayUtcDate(),
    lastReviewedAt: new Date(),
    wrongCount: progress.wrongCount + 1,
  }
}

export function applyKnown(progress: StudyProgressSnapshot): StudyProgressSnapshot {
  return {
    ...progress,
    status: 'mastered',
    repetitions: 4,
    intervalDays: 60,
    nextReviewAt: addDays(todayUtcDate(), 60),
    lastReviewedAt: new Date(),
    correctCount: progress.correctCount + 1,
  }
}

export function applySkip(progress: StudyProgressSnapshot): StudyProgressSnapshot {
  return {
    ...progress,
    nextReviewAt: todayUtcDate(),
    lastReviewedAt: new Date(),
  }
}

export function normalizeAnswer(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function checkAnswer(input: string, expected: string): boolean {
  return normalizeAnswer(input) === normalizeAnswer(expected)
}

export function isDue(nextReviewAt: Date | null | undefined, status: StudyWordStatus): boolean {
  if (status === 'new') return false
  if (!nextReviewAt) return status === 'learning'
  return nextReviewAt.getTime() <= Date.now()
}
