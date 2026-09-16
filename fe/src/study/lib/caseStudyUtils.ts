import type { CaseStudyBookletPage, CaseStudyPartCounts } from "./caseStudyTypes";

export function normalizePartCounts(
  partCounts: CaseStudyPartCounts | undefined,
): CaseStudyPartCounts {
  return partCounts ?? { 5: 0, 6: 0, 7: 0 };
}

export function bookletPagesForQuestion(
  pages: CaseStudyBookletPage[],
  questionNumber: number,
): CaseStudyBookletPage[] {
  return pages.filter(
    (p) =>
      p.questionFrom > 0 &&
      p.questionTo > 0 &&
      questionNumber >= p.questionFrom &&
      questionNumber <= p.questionTo,
  );
}

export function uncoveredQuestionNumbers(
  pages: Array<{ questionFrom: number; questionTo: number }>,
  questionNumbers: number[],
): number[] {
  const expected = [...new Set(questionNumbers)].sort((a, b) => a - b);
  if (expected.length === 0) return [];

  const expectedSet = new Set(expected);
  const covered = new Set<number>();
  for (const page of pages) {
    if (page.questionFrom <= 0 || page.questionTo <= 0) continue;
    const from = Math.min(page.questionFrom, page.questionTo);
    const to = Math.max(page.questionFrom, page.questionTo);
    for (let n = from; n <= to; n++) {
      if (expectedSet.has(n)) covered.add(n);
    }
  }

  return expected.filter((n) => !covered.has(n));
}

/** Split parsed question numbers evenly across booklet pages (starting point for manual edits). */
export function suggestBookletPageRanges(
  pageCount: number,
  questionNumbers: number[],
): Array<{ questionFrom: number; questionTo: number }> {
  const sorted = [...new Set(questionNumbers)].sort((a, b) => a - b);
  if (pageCount <= 0 || sorted.length === 0) {
    return Array.from({ length: Math.max(pageCount, 0) }, () => ({
      questionFrom: 0,
      questionTo: 0,
    }));
  }

  return Array.from({ length: pageCount }, (_, i) => {
    const startIdx = Math.floor((i * sorted.length) / pageCount);
    const endIdx = Math.floor(((i + 1) * sorted.length) / pageCount) - 1;
    if (startIdx >= sorted.length) {
      return { questionFrom: 0, questionTo: 0 };
    }
    return {
      questionFrom: sorted[startIdx],
      questionTo: sorted[Math.max(startIdx, endIdx)],
    };
  });
}
