import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Input, Select, Spin, Tag, message } from "antd";

import { fetchManageCaseSet, updateCaseStudySet } from "../lib/caseStudyApi";
import type { CaseStudyManageDetail } from "../lib/caseStudyTypes";
import { normalizePartCounts } from "../lib/caseStudyUtils";
import { studyKeys } from "../lib/queryKeys";

function ManageCaseStudyDetailForm({
  data,
  setId,
}: {
  data: CaseStudyManageDetail;
  setId: string;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(data.set.title);
  const [description, setDescription] = useState(data.set.description);
  const [status, setStatus] = useState<"draft" | "published">(data.set.status);

  const partCounts = useMemo(
    () => normalizePartCounts(data.set.partCounts),
    [data.set.partCounts],
  );

  const handlePublish = async () => {
    setSaving(true);
    try {
      await updateCaseStudySet(setId, {
        title,
        description,
        status,
        passages: data.passages.map((p) => ({
          id: p.id,
          part: p.part,
          label: p.label,
          contentEn: p.contentEn,
          contentVi: p.contentVi ?? "",
          sortOrder: p.sortOrder,
        })),
        questions: data.questions.map((q) => ({
          id: q.id,
          part: q.part,
          number: q.number,
          stemEn: q.stemEn,
          options: q.options,
          correctKey: q.correctKey,
          explanationVi: q.explanationVi,
          passageId: q.passageId,
          sortOrder: q.sortOrder,
        })),
      });
      message.success("Đã cập nhật");
      await queryClient.invalidateQueries({ queryKey: studyKeys.manageCaseSet(setId) });
      await queryClient.invalidateQueries({ queryKey: studyKeys.manageCaseSets });
    } catch {
      message.error("Cập nhật thất bại");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        to="/study/cases?tab=manage"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-indigo-600"
      >
        <ArrowLeftOutlined />
        Quản lý Case Study
      </Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Chỉnh sửa bộ đề</h1>
              <Tag color={status === "published" ? "green" : "default"}>
                {status === "published" ? "Đã đăng" : "Nháp"}
              </Tag>
            </div>
            <p className="text-sm text-slate-500">
              {data.questions.length} câu hỏi · {data.passages.length} đoạn đọc
            </p>
          </div>
          <Button
            type="primary"
            loading={saving}
            className="shrink-0"
            onClick={() => void handlePublish()}
          >
            Lưu thay đổi
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Part 5", value: partCounts[5] },
            { label: "Part 6", value: partCounts[6] },
            { label: "Part 7", value: partCounts[7] },
            { label: "Đoạn đọc", value: data.passages.length },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-center"
            >
              <strong className="block text-lg text-indigo-600">{item.value}</strong>
              <span className="text-xs text-slate-500">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Thông tin bộ đề
        </h2>
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Tiêu đề</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: ETS 2026 Reading Test 1"
              size="large"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Mô tả</span>
            <Input.TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn về bộ đề (tuỳ chọn)"
              rows={3}
            />
          </label>
          <label className="block max-w-xs space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Trạng thái</span>
            <Select
              className="w-full"
              size="large"
              value={status}
              onChange={setStatus}
              options={[
                { value: "draft", label: "Nháp — chỉ admin thấy" },
                { value: "published", label: "Đăng — hiện trong Luyện tập" },
              ]}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
          <Button type="primary" loading={saving} onClick={() => void handlePublish()}>
            Lưu thay đổi
          </Button>
        </div>
      </section>
    </div>
  );
}

export function ManageCaseStudyDetail() {
  const { setId = "" } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: studyKeys.manageCaseSet(setId),
    queryFn: () => fetchManageCaseSet(setId),
    enabled: Boolean(setId),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    );
  }

  return <ManageCaseStudyDetailForm key={setId} data={data} setId={setId} />;
}
