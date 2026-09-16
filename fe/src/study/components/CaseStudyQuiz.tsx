import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Spin, message } from "antd";
import { CloseOutlined } from "@ant-design/icons";

import { apiAssetUrl } from "../../lib/api";
import {
  checkCaseQuestion,
  fetchCaseStudySet,
  updateCaseProgress,
} from "../lib/caseStudyApi";
import { PART_LABELS, type CaseStudyBookletPage, type CaseStudyPart } from "../lib/caseStudyTypes";
import type { CaseStudyQuestion } from "../lib/caseStudyTypes";
import { bookletPagesForQuestion } from "../lib/caseStudyUtils";
import { studyKeys } from "../lib/queryKeys";
import "./case-study-quiz.css";

type AnswerState = {
  chosenKey: string;
  correct: boolean;
  correctKey: string;
  explanationVi: string;
  checked: boolean;
};

const VALID_PARTS = new Set<CaseStudyPart>([5, 6, 7]);

function parsePartFilter(raw: string | undefined): CaseStudyPart | null {
  if (!raw) return null;
  const n = Number(raw);
  return VALID_PARTS.has(n as CaseStudyPart) ? (n as CaseStudyPart) : null;
}

type QuizSessionProps = {
  setId: string;
  partFilter: CaseStudyPart | null;
  questions: CaseStudyQuestion[];
  passages: { id: string; contentEn: string; label: string }[];
  bookletPages: CaseStudyBookletPage[];
  initialAnswers: Record<string, AnswerState>;
  initialIndex: number;
};

function QuizSession({
  setId,
  partFilter,
  questions,
  passages,
  bookletPages,
  initialAnswers,
  initialIndex,
}: QuizSessionProps) {
  const [index, setIndex] = useState(initialIndex);
  const [answers, setAnswers] = useState(initialAnswers);
  const [explainOpenForId, setExplainOpenForId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const current = questions[index];
  const currentAnswer = current ? answers[current.id] : undefined;
  const partMeta = current ? PART_LABELS[current.part] : null;
  const explainOpen = explainOpenForId === current?.id;

  const passage = useMemo(() => {
    if (!current?.passageId) return null;
    return passages.find((p) => p.id === current.passageId) ?? null;
  }, [current, passages]);

  const currentBookletPages = useMemo(() => {
    if (!current || bookletPages.length === 0) return [];
    return bookletPagesForQuestion(bookletPages, current.number);
  }, [bookletPages, current]);

  const useBookletImages = currentBookletPages.length > 0;

  const persistProgress = async (nextIndex: number, completed?: boolean) => {
    if (partFilter) return;
    try {
      await updateCaseProgress(setId, nextIndex, completed);
    } catch {
      /* ignore */
    }
  };

  const handleChoose = async (key: string) => {
    if (!current || currentAnswer?.checked || checking) return;
    setChecking(true);
    try {
      const result = await checkCaseQuestion(setId, current.id, key);
      setAnswers((prev) => ({
        ...prev,
        [current.id]: {
          chosenKey: key,
          correct: result.correct,
          correctKey: result.correctKey,
          explanationVi: result.explanationVi,
          checked: true,
        },
      }));
      if (!result.correct) setExplainOpenForId(current.id);
    } catch {
      message.error("Không kiểm tra được đáp án");
    } finally {
      setChecking(false);
    }
  };

  const goNext = () => {
    setExplainOpenForId(null);
    if (index + 1 >= questions.length) {
      void persistProgress(index, true);
      return;
    }
    const next = index + 1;
    setIndex(next);
    void persistProgress(next);
  };

  const goBack = () => {
    if (index <= 0) return;
    setExplainOpenForId(null);
    const prev = index - 1;
    setIndex(prev);
    void persistProgress(prev);
  };

  if (!current) {
    const sessionScore = questions.filter((q) => answers[q.id]?.correct).length;
    const answeredInSession = questions.filter((q) => answers[q.id]).length;

    return (
      <div className="case-quiz-shell">
        <div className="case-quiz-done">
          <h2>Hoàn thành</h2>
          {partFilter ? (
            <p>
              {sessionScore} / {questions.length} câu đúng (Part {partFilter})
            </p>
          ) : (
            <p>
              {sessionScore} / {questions.length} câu đúng
            </p>
          )}
          {partFilter && answeredInSession < questions.length && (
            <p style={{ fontSize: 13, opacity: 0.7 }}>
              Đã trả lời {answeredInSession}/{questions.length} câu trong Part này
            </p>
          )}
          <Link to="/study/cases" className="study-btn study-btn-primary" style={{ marginTop: 16 }}>
            Về danh sách
          </Link>
        </div>
      </div>
    );
  }

  const finishedLast =
    index + 1 >= questions.length && currentAnswer?.checked;

  return (
    <div className="case-quiz-shell">
      <header className="case-quiz-header">
        <div className="case-quiz-header-left">
          <Link to="/study/cases" className="case-quiz-close" aria-label="Đóng">
            <CloseOutlined />
          </Link>
          <div className="case-quiz-part">
            <strong>{partMeta?.title ?? `PART ${current.part}`}</strong>
            <span>{partMeta?.subtitle ?? ""}</span>
          </div>
        </div>
        <div className="case-quiz-progress-wrap">
          <div className="case-quiz-progress">
            {index + 1}/{questions.length}
          </div>
          <div className="case-quiz-progress-bar" aria-hidden>
            <span style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
          </div>
        </div>
      </header>

      <main
        className={`case-quiz-body${useBookletImages ? " case-quiz-body--split" : ""}`}
      >
        {useBookletImages ? (
          <div className="case-quiz-booklet-panel">
            <div className="case-quiz-section-title">Đề gốc</div>
            {currentBookletPages.map((page) => (
              <img
                key={page.pageIndex}
                src={apiAssetUrl(page.url)}
                alt={`Trang đề ${page.pageIndex + 1}`}
                className="case-quiz-booklet-img"
              />
            ))}
          </div>
        ) : (
          passage?.contentEn?.trim() && (
            <>
              <div className="case-quiz-section-title">Reading</div>
              <div className="case-quiz-passage">{passage.contentEn}</div>
            </>
          )
        )}

        <div className="case-quiz-answer-panel">
          <div className="case-quiz-stem">
            {current.number}. {current.stemEn}
          </div>

          <div className="case-quiz-options">
            {current.options.map((opt) => {
              const selected = currentAnswer?.chosenKey === opt.key;
              const showResult = currentAnswer?.checked;
              const isCorrectKey = showResult && opt.key === currentAnswer.correctKey;
              const isWrongPick = showResult && selected && !currentAnswer.correct;

              let className = "case-quiz-option";
              if (selected) className += " selected";
              if (isCorrectKey) className += " correct";
              if (isWrongPick) className += " wrong";

              return (
                <button
                  key={opt.key}
                  type="button"
                  className={className}
                  disabled={currentAnswer?.checked || checking}
                  onClick={() => void handleChoose(opt.key)}
                >
                  <span className="case-quiz-option-key">{opt.key}.</span>
                  <span>{opt.textEn}</span>
                </button>
              );
            })}
          </div>

          {currentAnswer?.checked && (
            <>
              <div
                className={`case-quiz-feedback ${currentAnswer.correct ? "ok" : "bad"}`}
              >
                {currentAnswer.correct
                  ? "Đúng"
                  : `Sai (đáp án đúng: ${currentAnswer.correctKey})`}
              </div>
              {currentAnswer.explanationVi && (
                <>
                  <button
                    type="button"
                    className="case-quiz-explain-toggle"
                    onClick={() =>
                      setExplainOpenForId((id) => (id === current.id ? null : current.id))
                    }
                  >
                    {explainOpen ? "▾ Ẩn giải thích" : "▸ Xem giải thích"}
                  </button>
                  {explainOpen && (
                    <div className="case-quiz-explain-box">{currentAnswer.explanationVi}</div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="case-quiz-footer">
        <button type="button" className="case-quiz-back" onClick={goBack} disabled={index <= 0}>
          Quay lại
        </button>
        <button
          type="button"
          className="case-quiz-next"
          disabled={!currentAnswer?.checked}
          onClick={() => {
            if (finishedLast) {
              void persistProgress(index, true);
              setIndex(questions.length);
              return;
            }
            goNext();
          }}
        >
          {finishedLast ? "Hoàn thành" : "Tiếp theo"}
        </button>
      </footer>
    </div>
  );
}

export function CaseStudyQuiz() {
  const { setId = "", part: partParam } = useParams();
  const partFilter = parsePartFilter(partParam);

  const { data, isLoading, isError } = useQuery({
    queryKey: [...studyKeys.caseSet(setId), partFilter ?? "full"],
    queryFn: () => fetchCaseStudySet(setId),
    enabled: Boolean(setId),
  });

  const session = useMemo(() => {
    if (!data) return null;

    let filteredQuestions = data.questions;
    if (partFilter) {
      filteredQuestions = data.questions.filter((q) => q.part === partFilter);
    }
    if (filteredQuestions.length === 0) return null;

    const passageIds = new Set(
      filteredQuestions.map((q) => q.passageId).filter(Boolean) as string[],
    );
    const filteredPassages = partFilter
      ? data.passages.filter((p) => passageIds.has(p.id))
      : data.passages;

    const restored: Record<string, AnswerState> = {};
    if (data.attempt?.answers) {
      for (const [qid, ans] of Object.entries(data.attempt.answers)) {
        restored[qid] = {
          chosenKey: ans.chosenKey,
          correct: ans.correct,
          correctKey: ans.correctKey,
          explanationVi: ans.explanationVi,
          checked: true,
        };
      }
    }

    const initialIndex = partFilter
      ? Math.max(
          0,
          filteredQuestions.findIndex((q) => !restored[q.id]),
        )
      : Math.min(
          data.attempt?.currentIndex ?? 0,
          filteredQuestions.length - 1,
        );

    return {
      questions: filteredQuestions,
      passages: filteredPassages.map((p) => ({
        id: p.id,
        contentEn: p.contentEn,
        label: p.label,
      })),
      bookletPages: data.bookletPages ?? [],
      initialAnswers: restored,
      initialIndex,
    };
  }, [data, partFilter]);

  if (isLoading) {
    return (
      <div className="case-quiz-shell">
        <div className="study-center-loading" style={{ flex: 1 }}>
          <Spin />
        </div>
      </div>
    );
  }

  if (isError || !data || !session) {
    return <Navigate to="/study/cases" replace />;
  }

  return (
    <QuizSession
      key={`${setId}-${partFilter ?? "full"}`}
      setId={setId}
      partFilter={partFilter}
      questions={session.questions}
      passages={session.passages}
      bookletPages={session.bookletPages}
      initialAnswers={session.initialAnswers}
      initialIndex={session.initialIndex}
    />
  );
}
