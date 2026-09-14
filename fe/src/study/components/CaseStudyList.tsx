import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, Empty, Spin, Tag, message } from "antd";
import {
  FileTextOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReadOutlined,
} from "@ant-design/icons";

import { fetchCaseStudySets } from "../lib/caseStudyApi";
import {
  CASE_STUDY_PARTS,
  PART_LABELS,
  type CaseStudyPart,
  type CaseStudySetSummary,
} from "../lib/caseStudyTypes";
import { studyKeys } from "../lib/queryKeys";
import { normalizePartCounts } from "../lib/caseStudyUtils";

type Props = {
  onOpenManage?: () => void;
};

function PartTaskRow({ set, part }: { set: CaseStudySetSummary; part: CaseStudyPart }) {
  const count = normalizePartCounts(set.partCounts)[part];
  if (count === 0) return null;

  const meta = PART_LABELS[part];

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
      <div className="min-w-0">
        <span className="text-sm font-medium text-slate-800">{meta.title}</span>
        <span className="ml-2 text-sm text-slate-500">· {count} câu</span>
      </div>
      <Link
        to={`/study/cases/${set.id}/part/${part}`}
        className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
      >
        Luyện {meta.title}
      </Link>
    </div>
  );
}

export function CaseStudyPracticeTab({ onOpenManage }: Props) {
  const { data: sets = [], isLoading } = useQuery({
    queryKey: studyKeys.caseSets,
    queryFn: async () => {
      try {
        return await fetchCaseStudySets();
      } catch {
        message.error("Không tải được danh sách Case Study");
        throw new Error("fetch failed");
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <ReadOutlined />
          <span>Chọn bộ đề và task Part để luyện</span>
        </div>
        {onOpenManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onOpenManage}>
            Quản lý & import PDF
          </Button>
        )}
      </div>

      {sets.length === 0 ? (
        <Empty
          className="py-12"
          image={<FileTextOutlined style={{ fontSize: 56, color: "#94a3b8" }} />}
          description="Chưa có bộ đề nào. Upload PDF KEY để tạo đề mới."
        >
          {onOpenManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onOpenManage}>
              Upload PDF
            </Button>
          )}
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sets.map((set) => (
            <article
              key={set.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:border-indigo-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <Tag color="blue">Reading</Tag>
                <span className="text-xs text-slate-500">{set.questionCount} câu</span>
              </div>
              <h3 className="text-base font-semibold leading-snug text-slate-900">{set.title}</h3>
              {set.description && (
                <p className="text-sm text-slate-500">{set.description}</p>
              )}

              <div className="mt-1 rounded-xl bg-slate-50 px-3 py-1">
                {CASE_STUDY_PARTS.map((part) => (
                  <PartTaskRow key={part} set={set} part={part} />
                ))}
              </div>

              <Link
                to={`/study/cases/${set.id}`}
                className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                <PlayCircleOutlined />
                Luyện full · {set.questionCount} câu
              </Link>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

/** @deprecated Use CaseStudyHub at /study/cases */
export function CaseStudyList() {
  return <CaseStudyPracticeTab />;
}
