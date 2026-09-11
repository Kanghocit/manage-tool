import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Spin, message } from "antd";

import { ActivityHeatmap } from "./ActivityHeatmap";
import { ProgressRing } from "./ProgressRing";
import { fetchStudyDashboard } from "../lib/studyApi";
import { studyKeys } from "../lib/queryKeys";
import type { StudyList } from "../lib/types";

type Tab = "mine" | "learning" | "explore";

export function StudyDashboard() {
  const [tab, setTab] = useState<Tab>("learning");

  const { data, isLoading } = useQuery({
    queryKey: studyKeys.dashboard,
    queryFn: async () => {
      try {
        return await fetchStudyDashboard();
      } catch {
        message.error("Không tải được dữ liệu học tập");
        throw new Error("fetch failed");
      }
    },
  });

  const enrolledSet = useMemo(
    () => new Set(data?.enrolledListIds ?? []),
    [data?.enrolledListIds],
  );

  const filteredLists = useMemo(() => {
    if (!data) return [] as StudyList[];
    if (tab === "explore") return data.lists;
    if (tab === "mine") return data.lists.filter((l) => l.source === "user");
    return data.lists.filter((l) => enrolledSet.has(l.id));
  }, [data, tab, enrolledSet]);

  if (isLoading && !data) {
    return (
      <div className="study-center-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!data) return null;

  const { globalStats, activity } = data;
  const learnedPct =
    globalStats.total > 0
      ? Math.round((globalStats.learned / globalStats.total) * 100)
      : 0;

  return (
    <div>
      <section className="study-hero">
        <div>
          <h1>Luyện từ vựng TOEIC</h1>
          <p>
            Ôn tập theo list · SRS · {learnedPct}% tổng tiến độ
          </p>
        </div>
        <div className="study-hero-stats">
          <div className="study-hero-stat">
            <strong>{globalStats.learned}</strong>
            <span>Đã học</span>
          </div>
          <div className="study-hero-stat">
            <strong>{globalStats.mastered}</strong>
            <span>Đã nhớ</span>
          </div>
          <div className="study-hero-stat">
            <strong>{globalStats.due}</strong>
            <span>Cần ôn</span>
          </div>
        </div>
      </section>

      <section className="study-card" style={{ marginBottom: 20 }}>
        <h2 className="study-section-title">Hoạt động 12 tuần</h2>
        <ActivityHeatmap activity={activity} />
      </section>

      <div className="study-segment" role="tablist">
        {(
          [
            ["learning", "Đang học"],
            ["mine", "List của tôi"],
            ["explore", "Khám phá"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`study-segment-btn${tab === key ? " active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredLists.length === 0 ? (
        <div className="study-card study-empty-wrap">
          <p style={{ margin: 0, color: "var(--study-muted)", textAlign: "center" }}>
            Chưa có list nào. Vào tab Khám phá hoặc tạo list mới ở Quản lý.
          </p>
        </div>
      ) : (
        <div className="study-list-grid">
          {filteredLists.map((list) => {
            const stats = list.stats;
            const pct =
              stats && stats.total > 0
                ? Math.round((stats.learned / stats.total) * 100)
                : 0;
            return (
              <article key={list.id} className="study-topic-card">
                <div className="study-topic-accent" aria-hidden />
                <div className="study-topic-body">
                  <Link
                    to={`/study/lists/${list.id}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <h3>{list.title}</h3>
                    <p className="study-topic-meta">
                      {list.wordCount} từ
                      {stats
                        ? ` · Đã học ${stats.learned}/${stats.total}`
                        : ""}
                      {stats && stats.due > 0 ? ` · ${stats.due} cần ôn` : ""}
                    </p>
                  </Link>
                  <div className="study-topic-footer">
                    <ProgressRing percent={pct} />
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Link
                        to={`/study/lists/${list.id}`}
                        className="study-cta-link"
                      >
                        Chi tiết
                      </Link>
                      <Link
                        to={`/study/lists/${list.id}/review`}
                        className="study-cta-btn"
                      >
                        {pct > 0 ? "Học tiếp" : "Bắt đầu"}
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
