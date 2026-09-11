import { api } from "../../lib/api";
import type {
  StudyDashboard,
  StudyList,
  StudyListDetail,
  StudyWord,
} from "./types";

export async function fetchStudyDashboard() {
  const res = await api.get<{ success: boolean; data: StudyDashboard }>(
    "/api/study/dashboard",
  );
  return res.data.data;
}

export async function fetchStudyList(listId: string) {
  const res = await api.get<{ success: boolean; data: StudyListDetail }>(
    `/api/study/lists/${listId}`,
  );
  return res.data.data;
}

export async function fetchReviewQueue(listId: string) {
  const res = await api.get<{
    success: boolean;
    data: { queue: StudyWord[]; settings: { dailyNewWords: number } };
  }>(`/api/study/lists/${listId}/review-queue`);
  return res.data.data;
}

export async function postReviewAction(
  listId: string,
  wordId: string,
  action: "correct" | "wrong" | "skip" | "known",
) {
  await api.post(`/api/study/lists/${listId}/review`, { wordId, action });
}

export async function enrollList(listId: string) {
  await api.post(`/api/study/lists/${listId}/enroll`);
}

export async function unenrollList(listId: string) {
  await api.delete(`/api/study/lists/${listId}/enroll`);
}

export async function updateSettings(patch: {
  dailyNewWords?: number;
  showAllLearned?: boolean;
}) {
  await api.patch("/api/study/settings", patch);
}

export async function fetchManageLists() {
  const res = await api.get<{ success: boolean; lists: StudyList[] }>(
    "/api/study/manage/lists",
  );
  return res.data.lists;
}

export async function createList(title: string, description: string) {
  const res = await api.post<{ success: boolean; list: StudyList }>(
    "/api/study/manage/lists",
    { title, description },
  );
  return res.data.list;
}

export async function updateList(
  listId: string,
  patch: { title?: string; description?: string },
) {
  await api.patch(`/api/study/manage/lists/${listId}`, patch);
}

export async function deleteList(listId: string) {
  const res = await api.delete<{
    success: boolean;
    mode: "deleted" | "hidden";
    message: string;
  }>(`/api/study/manage/lists/${listId}`);
  return res.data;
}

export async function createWord(
  listId: string,
  data: Omit<StudyWord, "id" | "source">,
) {
  const res = await api.post<{ success: boolean; word: StudyWord }>(
    `/api/study/manage/lists/${listId}/words`,
    data,
  );
  return res.data.word;
}

export async function updateWord(
  listId: string,
  wordId: string,
  data: Partial<Omit<StudyWord, "id" | "source">>,
) {
  const res = await api.patch<{ success: boolean; word: StudyWord }>(
    `/api/study/manage/lists/${listId}/words/${wordId}`,
    data,
  );
  return res.data.word;
}

export async function deleteWord(listId: string, wordId: string) {
  await api.delete(`/api/study/manage/lists/${listId}/words/${wordId}`);
}

export async function importWordsFromPaste(listId: string, rawText: string) {
  const res = await api.post<{
    success: boolean;
    imported: number;
    words: StudyWord[];
    errors: { block: number; message: string; snippet: string }[];
  }>(`/api/study/manage/lists/${listId}/words/import-paste`, { rawText });
  return res.data;
}

export function checkAnswerLocal(input: string, expected: string) {
  const normalize = (v: string) =>
    v.trim().toLowerCase().replace(/\s+/g, " ");
  return normalize(input) === normalize(expected);
}
