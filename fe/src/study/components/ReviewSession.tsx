import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { InputNumber, Modal, Spin, message } from "antd";

import {
  checkAnswerLocal,
  fetchReviewQueue,
  postReviewAction,
  updateSettings,
} from "../lib/studyApi";
import { speakWord } from "../lib/speech";
import type { StudyWord } from "../lib/types";

export function ReviewSession() {
  const { listId = "" } = useParams();
  const [queue, setQueue] = useState<StudyWord[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });
  const [dailyNewWords, setDailyNewWords] = useState(30);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReviewQueue(listId);
      setQueue(data.queue);
      setDailyNewWords(data.settings.dailyNewWords);
      setIndex(0);
      setFinished(data.queue.length === 0);
    } catch {
      message.error("Không tải được queue ôn tập");
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const current = queue[index];

  useEffect(() => {
    if (!current) return;
    setInput("");
    setRevealed(false);
    setChecked(null);
    speakWord(current.word, "en-US");
    inputRef.current?.focus();
  }, [current?.id]);

  const example = current?.examples[0];

  const progressLabel = useMemo(() => {
    if (finished) return "Hoàn thành";
    return `${index + 1} / ${queue.length}`;
  }, [index, queue.length, finished]);

  const advance = () => {
    if (index + 1 >= queue.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
  };

  const handleCheck = async () => {
    if (!current) return;
    const ok = checkAnswerLocal(input, current.word);
    setChecked(ok);
    setRevealed(true);
    await postReviewAction(listId, current.id, ok ? "correct" : "wrong");
    setStats((s) => ({
      correct: s.correct + (ok ? 1 : 0),
      wrong: s.wrong + (ok ? 0 : 1),
    }));
  };

  const handleSkip = async () => {
    if (!current) return;
    await postReviewAction(listId, current.id, "skip");
    setQueue((q) => [...q.slice(0, index + 1), current, ...q.slice(index + 1)]);
    advance();
  };

  const handleKnown = async () => {
    if (!current) return;
    await postReviewAction(listId, current.id, "known");
    setStats((s) => ({ ...s, correct: s.correct + 1 }));
    advance();
  };

  const openSettings = () => {
    let value = dailyNewWords;
    Modal.confirm({
      title: "Cài đặt ôn tập",
      content: (
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", marginBottom: 8, fontSize: 13 }}>
            Số từ mới / ngày
          </label>
          <InputNumber
            min={1}
            max={200}
            defaultValue={dailyNewWords}
            onChange={(v) => {
              value = typeof v === "number" ? v : 30;
            }}
            style={{ width: "100%" }}
          />
        </div>
      ),
      okText: "Lưu",
      cancelText: "Huỷ",
      onOk: async () => {
        await updateSettings({ dailyNewWords: value });
        setDailyNewWords(value);
        message.success("Đã lưu cài đặt");
        await loadQueue();
      },
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <Spin />
      </div>
    );
  }

  if (finished) {
    return (
      <div className="study-card study-review-card">
        <div>
          <Link to={`/study/lists/${listId}`} style={{ fontSize: 13 }}>
            ← Quay lại list
          </Link>
          <h2 style={{ margin: "12px 0 8px" }}>Kết thúc phiên ôn tập</h2>
          <p style={{ color: "var(--study-muted)" }}>
            Đúng: {stats.correct} · Sai: {stats.wrong}
          </p>
        </div>
        <button
          type="button"
          className="study-btn study-btn-primary study-btn-block"
          onClick={() => {
            setStats({ correct: 0, wrong: 0 });
            void loadQueue();
          }}
        >
          Ôn tiếp
        </button>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="study-card">
        <p>Không có từ để ôn.</p>
        <button type="button" className="study-btn study-btn-secondary" onClick={openSettings}>
          Cài đặt
        </button>
      </div>
    );
  }

  return (
    <div className="study-review-layout">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <Link to={`/study/lists/${listId}`} style={{ fontSize: 13 }}>
          ← Thoát
        </Link>
        <span style={{ fontSize: 13, color: "var(--study-muted)" }}>{progressLabel}</span>
        <button
          type="button"
          className="study-btn study-btn-secondary"
          style={{ minHeight: 36, padding: "0 10px", fontSize: 12 }}
          onClick={openSettings}
        >
          ⚙️
        </button>
      </div>

      <div className="study-card study-review-card">
        <div>
          <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>
            {current.imageEmoji}
          </div>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <span className="study-badge">{current.pos}</span>
          </div>
          <p style={{ fontSize: 15, margin: "0 0 8px" }}>{current.definitionVi}</p>
          <p style={{ fontSize: 13, color: "var(--study-muted)", margin: "0 0 12px" }}>
            {current.definitionEn}
          </p>
          {example && (
            <p style={{ fontSize: 14, lineHeight: 1.5, background: "#f8fafc", padding: 12, borderRadius: 12 }}>
              {example.en}
            </p>
          )}
        </div>

        <div>
          {!revealed ? (
            <>
              <input
                ref={inputRef}
                className="study-review-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Gõ từ tiếng Anh..."
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCheck();
                }}
              />
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  className="study-btn study-btn-primary study-btn-block"
                  onClick={() => void handleCheck()}
                >
                  Kiểm tra
                </button>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    type="button"
                    className="study-btn study-btn-secondary"
                    onClick={() => void handleSkip()}
                  >
                    Bỏ qua
                  </button>
                  <button
                    type="button"
                    className="study-btn study-btn-secondary"
                    onClick={() => void handleKnown()}
                  >
                    Đã biết
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  textAlign: "center",
                  padding: 12,
                  borderRadius: 12,
                  background: checked ? "#dcfce7" : "#fee2e2",
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {checked ? "Chính xác!" : "Chưa đúng"}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{current.word}</div>
                <div style={{ fontSize: 12, color: "var(--study-muted)" }}>{current.ipa}</div>
              </div>
              <button
                type="button"
                className="study-btn study-btn-primary study-btn-block"
                onClick={advance}
              >
                Từ tiếp theo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
