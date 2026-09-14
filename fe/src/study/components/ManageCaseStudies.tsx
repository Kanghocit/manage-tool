import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { App as AntApp, Empty, Modal, Spin, Tag, Upload, message } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  FilePdfOutlined,
  PlayCircleOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import {
  createCaseStudySet,
  deleteCaseStudySet,
  fetchManageCaseSets,
  parseCaseStudyPdf,
} from "../lib/caseStudyApi";
import type { CaseStudyParsePreview } from "../lib/caseStudyTypes";
import { studyKeys } from "../lib/queryKeys";
import { CaseStudyImportReview } from "./CaseStudyImportReview.tsx";

const miniBtnClass =
  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors";

export function CaseStudyManageTab() {
  const { modal } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<CaseStudyParsePreview | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<File | null>(null);

  const { data: sets = [], isLoading } = useQuery({
    queryKey: studyKeys.manageCaseSets,
    queryFn: fetchManageCaseSets,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: studyKeys.manageCaseSets });

  const handleUpload = async (file: File) => {
    setUploading(true);
    fileRef.current = file;
    try {
      const result = await parseCaseStudyPdf(file);
      setPreview(result);
      setReviewOpen(true);
      if (result.warnings.length) {
        message.warning(`${result.warnings.length} cảnh báo khi parse PDF`);
      } else {
        message.success(`Đã trích ${result.questions.length} câu hỏi`);
      }
    } catch {
      message.error("Không parse được PDF");
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleSave = async (
    payload: CaseStudyParsePreview & {
      title: string;
      description: string;
      status: "draft" | "published";
    },
  ) => {
    setSaving(true);
    try {
      await createCaseStudySet({
        title: payload.title,
        description: payload.description,
        status: payload.status,
        passages: payload.passages,
        questions: payload.questions,
      });
      message.success("Đã lưu bộ đề");
      setReviewOpen(false);
      setPreview(null);
      fileRef.current = null;
      await refresh();
      await queryClient.invalidateQueries({ queryKey: studyKeys.caseSets });
    } catch {
      message.error("Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, title: string) => {
    modal.confirm({
      title: "Xoá bộ đề này?",
      content: title,
      okText: "Xoá",
      okButtonProps: { danger: true },
      cancelText: "Huỷ",
      onOk: async () => {
        await deleteCaseStudySet(id);
        message.success("Đã xoá");
        await refresh();
        await queryClient.invalidateQueries({ queryKey: studyKeys.caseSets });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    );
  }

  return (
    <>
      <Upload.Dragger
        accept=".pdf,application/pdf"
        showUploadList={false}
        beforeUpload={(file) => {
          void handleUpload(file);
          return false;
        }}
        className="mb-5 rounded-2xl!"
        disabled={uploading}
      >
        <p className="ant-upload-drag-icon">
          <UploadOutlined className="text-indigo-500!" />
        </p>
        <p className="ant-upload-text">Kéo thả hoặc bấm để chọn file PDF KEY</p>
        <p className="ant-upload-hint">
          Hỗ trợ Part 5, 6, 7 · file nén ~2MB vẫn parse được
        </p>
        {uploading && <Spin className="mt-3" />}
      </Upload.Dragger>

      {sets.length === 0 ? (
        <Empty
          className="py-12 "
          image={<FilePdfOutlined style={{ fontSize: 48, color: "#94a3b8" }} />}
          description="Chưa có bộ đề nào"
        />
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {sets.map((set) => (
            <article
              key={set.id}
              className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <Tag color={set.status === "published" ? "green" : "default"}>
                  {set.status === "published" ? "Đã đăng" : "Nháp"}
                </Tag>
                <span className="text-xs text-slate-500">
                  {set.questionCount} câu
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                {set.title}
              </h3>
              {set.description && (
                <p className="text-sm text-slate-500">{set.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {set.status === "published" && (
                  <Link
                    to={`/study/cases/${set.id}`}
                    className={clsx(
                      miniBtnClass,
                      "border-indigo-200 text-indigo-600 hover:bg-indigo-50",
                    )}
                  >
                    <PlayCircleOutlined /> Luyện full
                  </Link>
                )}
                <Link
                  to={`/study/cases/${set.id}/edit`}
                  className={clsx(
                    miniBtnClass,
                    "border-slate-200 text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <EditOutlined /> Sửa
                </Link>
                <button
                  type="button"
                  className={clsx(
                    miniBtnClass,
                    "border-red-200 text-red-600 hover:bg-red-50",
                  )}
                  onClick={() => handleDelete(set.id, set.title)}
                >
                  <DeleteOutlined /> Xoá
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        title="Duyệt đề sau khi import PDF"
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        footer={null}
        width="95vw"
        style={{ maxWidth: 1100, top: 24 }}
        destroyOnClose
      >
        {preview && (
          <CaseStudyImportReview
            preview={preview}
            saving={saving}
            onCancel={() => setReviewOpen(false)}
            onSave={handleSave}
          />
        )}
      </Modal>
    </>
  );
}

/** @deprecated Use CaseStudyHub at /study/cases?tab=manage */
export function ManageCaseStudies() {
  return <CaseStudyManageTab />;
}
