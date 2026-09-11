import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Spin, message } from "antd";

import { fetchStudyList } from "../lib/studyApi";
import { speakWord } from "../lib/speech";
import type { StudyWord } from "../lib/types";

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function RandomBrowse() {
  const { listId = "" } = useParams();
  const [words, setWords] = useState<StudyWord[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const detail = await fetchStudyList(listId);
        setWords(detail.words);
        setOrder(shuffle(detail.words.map((w) => w.id)));
      } catch {
        message.error("Không tải được list");
      } finally {
        setLoading(false);
      }
    })();
  }, [listId]);

  const wordMap = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const current = wordMap.get(order[index] ?? "");

  const next = () => {
    if (order.length <= 1) return;
    setIndex((i) => (i + 1) % order.length);
  };

  const reshuffle = () => {
    setOrder(shuffle(words.map((w) => w.id)));
    setIndex(0);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <Spin />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="study-card">
        <p>List trống.</p>
        <Link to={`/study/lists/${listId}`}>← Quay lại</Link>
      </div>
    );
  }

  const example = current.examples[0];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <Link to={`/study/lists/${listId}`} style={{ fontSize: 13 }}>
          ← Quay lại
        </Link>
        <span style={{ fontSize: 13, color: "var(--study-muted)" }}>
          {index + 1}/{order.length}
        </span>
      </div>

      <div className="study-card">
        <div style={{ fontSize: 48, textAlign: "center" }}>{current.imageEmoji}</div>
        <h2 style={{ textAlign: "center", margin: "8px 0 4px", fontSize: 24 }}>{current.word}</h2>
        <p style={{ textAlign: "center", color: "var(--study-muted)", fontSize: 13 }}>
          {current.pos} · {current.ipa}
        </p>
        <p style={{ fontSize: 15, marginTop: 12 }}>{current.definitionVi}</p>
        <p style={{ fontSize: 13, color: "var(--study-muted)" }}>{current.definitionEn}</p>
        {example && (
          <div style={{ marginTop: 12, fontSize: 14, background: "#f8fafc", padding: 12, borderRadius: 12 }}>
            {example.en}
            <br />
            <span style={{ color: "var(--study-muted)" }}>{example.vi}</span>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
          <button
            type="button"
            className="study-btn study-btn-secondary"
            onClick={() => speakWord(current.word, "en-GB")}
          >
            UK 🔊
          </button>
          <button
            type="button"
            className="study-btn study-btn-secondary"
            onClick={() => speakWord(current.word, "en-US")}
          >
            US 🔊
          </button>
        </div>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <button type="button" className="study-btn study-btn-primary study-btn-block" onClick={next}>
            Từ khác
          </button>
          <button type="button" className="study-btn study-btn-secondary study-btn-block" onClick={reshuffle}>
            Xáo trộn lại
          </button>
        </div>
      </div>
    </div>
  );
}
