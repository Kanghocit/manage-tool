export type WordStatus = "new" | "learning" | "review" | "mastered";

export type StudyExample = { en: string; vi: string };

export type StudyWord = {
  id: string;
  word: string;
  pos: string;
  ipa: string;
  definitionVi: string;
  definitionEn: string;
  examples: StudyExample[];
  imageEmoji: string;
  source: "seed" | "user";
};

export type StudyList = {
  id: string;
  title: string;
  description: string;
  source: "seed" | "user";
  wordCount: number;
  stats?: ListStats;
};

export type ListStats = {
  total: number;
  learned: number;
  mastered: number;
  due: number;
};

export type WordProgress = {
  wordId: string;
  listId: string;
  status: WordStatus;
  intervalDays: number;
  easiness: number;
  repetitions: number;
  nextReviewAt: string | null;
  lastReviewedAt: string | null;
  correctCount: number;
  wrongCount: number;
};

export type StudyDashboard = {
  lists: StudyList[];
  globalStats: ListStats;
  activity: Record<string, number>;
  settings: { dailyNewWords: number; showAllLearned: boolean };
  enrolledListIds: string[];
};

export type StudyListDetail = {
  list: StudyList & { stats: ListStats };
  words: StudyWord[];
  progress: WordProgress[];
  enrolled: boolean;
};
