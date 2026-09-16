export type CaseStudyOption = { key: string; textEn: string };

export type CaseStudyPartCounts = { 5: number; 6: number; 7: number };

export type CaseStudySetSummary = {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published";
  questionCount: number;
  partCounts: CaseStudyPartCounts;
  createdAt: string;
};

export const CASE_STUDY_PARTS = [5, 6, 7] as const;
export type CaseStudyPart = (typeof CASE_STUDY_PARTS)[number];

export type CaseStudyPassage = {
  id: string;
  part: number;
  label: string;
  contentEn: string;
  contentVi?: string;
  sortOrder: number;
};

export type CaseStudyQuestion = {
  id: string;
  part: number;
  number: number;
  stemEn: string;
  options: CaseStudyOption[];
  passageId: string | null;
  sortOrder: number;
};

export type CaseStudyQuestionManage = CaseStudyQuestion & {
  correctKey: string;
  explanationVi: string;
};

export type CaseStudyAttemptState = {
  currentIndex: number;
  completed: boolean;
  answers: Record<
    string,
    { chosenKey: string; correct: boolean; correctKey: string; explanationVi: string }
  >;
};

export type CaseStudyBookletPage = {
  pageIndex: number;
  questionFrom: number;
  questionTo: number;
  url: string;
};

export type CaseStudyBookletPageInput = {
  pageIndex: number;
  questionFrom: number;
  questionTo: number;
};

export type CaseStudyParsePdfsResult = {
  preview: CaseStudyParsePreview;
  sessionId: string;
  bookletPages: Array<{ pageIndex: number; url: string }>;
};

export type CaseStudySetDetail = {
  set: CaseStudySetSummary;
  passages: CaseStudyPassage[];
  questions: CaseStudyQuestion[];
  bookletPages: CaseStudyBookletPage[];
  attempt: CaseStudyAttemptState | null;
};

export type CaseStudyManageDetail = {
  set: CaseStudySetSummary;
  passages: CaseStudyPassage[];
  questions: CaseStudyQuestionManage[];
  bookletPages: CaseStudyBookletPage[];
};

export type CaseStudyParsePreview = {
  title: string;
  passages: Array<{
    part: 6 | 7;
    label: string;
    contentEn: string;
    contentVi?: string;
    questionNumbers: number[];
  }>;
  questions: Array<{
    part: 5 | 6 | 7;
    number: number;
    stemEn: string;
    options: CaseStudyOption[];
    correctKey: string;
    explanationVi: string;
    passageLabel?: string;
    answerUncertain?: boolean;
  }>;
  warnings: string[];
};

export const PART_LABELS: Record<number, { title: string; subtitle: string }> = {
  5: { title: "PART 5", subtitle: "Incomplete Sentences" },
  6: { title: "PART 6", subtitle: "Text Completion" },
  7: { title: "PART 7", subtitle: "Reading Comprehension" },
};
