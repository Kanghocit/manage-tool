import type { CaseStudyPartCounts } from "./caseStudyTypes";

export function normalizePartCounts(
  partCounts: CaseStudyPartCounts | undefined,
): CaseStudyPartCounts {
  return partCounts ?? { 5: 0, 6: 0, 7: 0 };
}
