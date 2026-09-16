import { api } from "../../lib/api";
import type {
  CaseStudyBookletPageInput,
  CaseStudyManageDetail,
  CaseStudyParsePreview,
  CaseStudyParsePdfsResult,
  CaseStudySetDetail,
  CaseStudySetSummary,
} from "./caseStudyTypes";

export async function fetchCaseStudySets() {
  const res = await api.get<{ success: boolean; sets: CaseStudySetSummary[] }>(
    "/api/study/cases",
  );
  return res.data.sets;
}

export async function fetchCaseStudySet(setId: string) {
  const res = await api.get<{ success: boolean; data: CaseStudySetDetail }>(
    `/api/study/cases/${setId}`,
  );
  return res.data.data;
}

export async function checkCaseQuestion(
  setId: string,
  questionId: string,
  chosenKey: string,
) {
  const res = await api.post<{
    success: boolean;
    correct: boolean;
    correctKey: string;
    explanationVi: string;
  }>(`/api/study/cases/${setId}/questions/${questionId}/check`, { chosenKey });
  return res.data;
}

export async function updateCaseProgress(
  setId: string,
  currentIndex: number,
  completed?: boolean,
) {
  await api.patch(`/api/study/cases/${setId}/progress`, {
    currentIndex,
    completed,
  });
}

export async function fetchManageCaseSets() {
  const res = await api.get<{ success: boolean; sets: CaseStudySetSummary[] }>(
    "/api/study/manage/cases",
  );
  return res.data.sets;
}

export async function fetchManageCaseSet(setId: string) {
  const res = await api.get<{ success: boolean; data: CaseStudyManageDetail }>(
    `/api/study/manage/cases/${setId}`,
  );
  return res.data.data;
}

export async function parseCaseStudyPdf(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post<{ success: boolean; preview: CaseStudyParsePreview }>(
    "/api/study/manage/cases/parse-pdf",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data.preview;
}

export async function parseCaseStudyPdfs(booklet: File, key: File) {
  const form = new FormData();
  form.append("booklet", booklet);
  form.append("key", key);
  const res = await api.post<{ success: boolean } & CaseStudyParsePdfsResult>(
    "/api/study/manage/cases/parse-pdfs",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data;
}

export async function createCaseStudySet(payload: {
  title: string;
  description?: string;
  status?: "draft" | "published";
  sessionId?: string;
  bookletPages?: CaseStudyBookletPageInput[];
  passages: CaseStudyParsePreview["passages"];
  questions: CaseStudyParsePreview["questions"];
}) {
  const res = await api.post<{ success: boolean; setId: string }>(
    "/api/study/manage/cases",
    payload,
  );
  return res.data.setId;
}

export async function updateCaseStudySet(
  setId: string,
  payload: Partial<{
    title: string;
    description: string;
    status: "draft" | "published";
    passages: Array<{
      id?: string;
      part: number;
      label: string;
      contentEn: string;
      sortOrder: number;
    }>;
    questions: Array<{
      id?: string;
      part: number;
      number: number;
      stemEn: string;
      options: { key: string; textEn: string }[];
      correctKey: string;
      explanationVi: string;
      passageId?: string | null;
      sortOrder: number;
    }>;
  }>,
) {
  await api.patch(`/api/study/manage/cases/${setId}`, payload);
}

export async function deleteCaseStudySet(setId: string) {
  await api.delete(`/api/study/manage/cases/${setId}`);
}
