import { useQuery } from "@tanstack/react-query";
import { Tabs } from "antd";
import { useSearchParams } from "react-router-dom";

import { fetchCaseStudySets, fetchManageCaseSets } from "../lib/caseStudyApi";
import { studyKeys } from "../lib/queryKeys";
import { CaseStudyPracticeTab } from "./CaseStudyList";
import { CaseStudyManageTab } from "./ManageCaseStudies";

type TabKey = "practice" | "manage";

function tabFromParams(params: URLSearchParams): TabKey {
  return params.get("tab") === "manage" ? "manage" : "practice";
}

export function CaseStudyHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromParams(searchParams);

  const { data: practiceSets = [] } = useQuery({
    queryKey: studyKeys.caseSets,
    queryFn: fetchCaseStudySets,
  });

  const { data: manageSets = [] } = useQuery({
    queryKey: studyKeys.manageCaseSets,
    queryFn: fetchManageCaseSets,
  });

  const publishedCount = practiceSets.length;
  const totalQuestions = practiceSets.reduce((sum, s) => sum + s.questionCount, 0);
  const draftCount = manageSets.filter((s) => s.status === "draft").length;

  const switchTab = (key: TabKey) => {
    if (key === "manage") {
      setSearchParams({ tab: "manage" });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <section className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-slate-50 to-white p-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-indigo-600">
            TOEIC Reading
          </p>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Case Study</h1>
          <p className="text-sm text-slate-500">
            Luyện Part 5, 6, 7 — câu hỏi tiếng Anh, giải thích tiếng Việt
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <div className="min-w-[80px] rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-center">
            <strong className="block text-xl text-indigo-600">{publishedCount}</strong>
            <span className="text-xs text-slate-500">Bộ đề đăng</span>
          </div>
          <div className="min-w-[80px] rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-center">
            <strong className="block text-xl text-indigo-600">{totalQuestions}</strong>
            <span className="text-xs text-slate-500">Tổng câu</span>
          </div>
          {draftCount > 0 && (
            <div className="min-w-[80px] rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-center">
              <strong className="block text-xl text-indigo-600">{draftCount}</strong>
              <span className="text-xs text-slate-500">Nháp</span>
            </div>
          )}
        </div>
      </section>

      <Tabs
        activeKey={tab}
        onChange={(key) => switchTab(key as TabKey)}
        items={[
          {
            key: "practice",
            label: "Luyện tập",
            children: (
              <CaseStudyPracticeTab onOpenManage={() => switchTab("manage")} />
            ),
          },
          {
            key: "manage",
            label: "Quản lý",
            children: <CaseStudyManageTab />,
          },
        ]}
      />
    </div>
  );
}
