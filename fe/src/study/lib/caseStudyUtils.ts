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
  min = 101,
  max = 200,
): number[] {
  const covered = new Set<number>();
  for (const page of pages) {
    if (page.questionFrom <= 0 || page.questionTo <= 0) continue;
    for (let n = page.questionFrom; n <= page.questionTo; n++) {
      if (n >= min && n <= max) covered.add(n);
    }
  }
  const missing: number[] = [];
  for (let n = min; n <= max; n++) {
    if (!covered.has(n)) missing.push(n);
  }
  return missing;
}
