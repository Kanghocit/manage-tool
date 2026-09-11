import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Modal, Spin, message } from "antd";

import { ActivityHeatmap } from "./ActivityHeatmap";
import {
  fetchStudyDashboard,
  fetchStudyList,
  unenrollList,
} from "../lib/studyApi";
import { studyKeys } from "../lib/queryKeys";
import { speakWord } from "../lib/speech";
import type { WordProgress, WordStatus } from "../lib/types";

function statusBadge(status: WordStatus) {
  const labels: Record<WordStatus, string> = {
    new: "Mới",
    learning: "Đang học",
    review: "Ôn tập",
    mastered: "Đã nhớ",
  };
  return (
    <span className={`study-badge ${status === "mastered" ? "mastered" : status}`}>
      {labels[status]}
    </span>
  );
}

export function ListDetail() {
  const { listId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: detail, isLoading: listLoading } = useQuery({
    queryKey: studyKeys.list(listId),
    queryFn: async () => {
      try {
        return await fetchStudyList(listId);
      } catch {
        message.error("Không tải được list");
        throw new Error("fetch failed");
      }
    },
    enabled: Boolean(listId),
  });

  const { data: dashboard } = useQuery({
    queryKey: studyKeys.dashboard,
    queryFn: fetchStudyDashboard,
  });

  const activity = dashboard?.activity ?? {};

  const progressMap = useMemo(() => {
    const map = new Map<string, WordProgress>();
    for (const p of detail?.progress ?? []) map.set(p.wordId, p);
    return map;
  }, [detail?.progress]);

  const handleUnenroll = () => {
    Modal.confirm({
      title: "Dừng học list này?",
      content: "List sẽ ẩn khỏi tab Đang học. Tiến độ vẫn được lưu.",
      okText: "Dừng học",
      cancelText: "Huỷ",
      onOk: async () => {
        await unenrollList(listId);
        message.success("Đã dừng học list");
        await queryClient.invalidateQueries({ queryKey: studyKeys.dashboard });
        navigate("/study");
      },
    });
  };

  if (listLoading && !detail) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <Spin />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="study-card">
        <p>Không tìm thấy list.</p>
        <Link to="/study">← Quay lại</Link>
      </div>
    );
  }

  const { list, words, enrolled } = detail;
  const stats = list.stats;

  return (
    <div>
      <nav className="study-breadcrumb">
        <Link to="/study">Luyện tập</Link>
        <span> / {list.title}</span>
      </nav>

      <div className="study-detail-grid">
      <section className="study-card study-span-full">
        <h1 className="study-page-title">{list.title}</h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--study-muted)" }}>
          {list.description}
        </p>
        <div className="study-stat-grid" style={{ marginTop: 12 }}>
          <div className="study-stat">
            <strong>{stats.total}</strong>
            <span>Tổng từ</span>
          </div>
          <div className="study-stat">
            <strong>{stats.learned}</strong>
            <span>Đã học</span>
          </div>
          <div className="study-stat">
            <strong>{stats.due}</strong>
            <span>Cần ôn</span>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
          <Link
            to={`/study/lists/${listId}/review`}
            className="study-cta-btn"
            style={{ textDecoration: "none" }}
          >
            Luyện tập
          </Link>
          <Link
            to={`/study/lists/${listId}/random`}
            className="study-btn study-btn-secondary"
            style={{ textDecoration: "none" }}
          >
            Xem ngẫu nhiên
          </Link>
          {enrolled && (
            <button
              type="button"
              className="study-btn study-btn-danger"
              onClick={handleUnenroll}
            >
              Dừng học
            </button>
          )}
        </div>
      </section>

      <section className="study-card">
        <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Heatmap list</h3>
        <ActivityHeatmap activity={activity} days={84} />
      </section>

      <section className="study-card study-span-full">
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Từ vựng ({words.length})</h3>
        {words.map((w) => {
          const p = progressMap.get(w.id);
          const status = p?.status ?? "new";
          const example = w.examples[0];
          return (
            <div key={w.id} className="study-word-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 16 }}>{w.word}</strong>
                  <span style={{ fontSize: 12, color: "var(--study-muted)" }}>{w.pos}</span>
                  {statusBadge(status)}
                  <span style={{ fontSize: 18 }}>{w.imageEmoji}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--study-muted)", marginTop: 2 }}>
                  {w.ipa}
                </div>
                <div style={{ fontSize: 13, marginTop: 6 }}>{w.definitionVi}</div>
                <div style={{ fontSize: 12, color: "var(--study-muted)", marginTop: 4 }}>
                  {w.definitionEn}
                </div>
                {example && (
                  <div style={{ fontSize: 12, marginTop: 6, color: "#334155" }}>
                    {example.en}
                    <br />
                    <span style={{ color: "var(--study-muted)" }}>{example.vi}</span>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  type="button"
                  className="study-btn study-btn-secondary"
                  style={{ minHeight: 36, padding: "0 10px", fontSize: 12 }}
                  onClick={() => speakWord(w.word, "en-GB")}
                >
                  UK
                </button>
                <button
                  type="button"
                  className="study-btn study-btn-secondary"
                  style={{ minHeight: 36, padding: "0 10px", fontSize: 12 }}
                  onClick={() => speakWord(w.word, "en-US")}
                >
                  US
                </button>
              </div>
            </div>
          );
        })}
      </section>
      </div>
    </div>
  );
}
