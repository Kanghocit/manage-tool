import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { App as AntApp, Button, Empty, Modal, Spin, Tag, Upload, message } from "antd";
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
  parseCaseStudyPdfs,
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
  const [bookletFile, setBookletFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CaseStudyParsePreview | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bookletPages, setBookletPages] = useState<Array<{ pageIndex: number; url: string }>>(
    [],
  );
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: sets = [], isLoading } = useQuery({
    queryKey: studyKeys.manageCaseSets,
    queryFn: fetchManageCaseSets,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: studyKeys.manageCaseSets });

  const handleAnalyze = async () => {
    if (!bookletFile || !keyFile) {
      message.warning("Chọn cả file đề gốc và file KEY");
      return;
    }
    setUploading(true);
    try {
      const result = await parseCaseStudyPdfs(bookletFile, keyFile);
      setPreview(result.preview);
      setSessionId(result.sessionId);
      setBookletPages(result.bookletPages);
      setReviewOpen(true);
      if (result.preview.warnings.length) {
        message.warning(`${result.preview.warnings.length} cảnh báo khi parse KEY`);
      } else {
        message.success(
          `Đã trích ${result.preview.questions.length} câu · ${result.bookletPages.length} trang ảnh`,
        );
      }
    } catch {
      message.error("Không parse được PDF");
    } finally {
      setUploading(false);
    }
  };

  const resetImport = () => {
    setPreview(null);
    setSessionId(null);
    setBookletPages([]);
    setBookletFile(null);
    setKeyFile(null);
  };

  const handleSave = async (
    payload: CaseStudyParsePreview & {
      title: string;
      description: string;
      status: "draft" | "published";
      sessionId?: string;
      bookletPages?: Array<{ pageIndex: number; questionFrom: number; questionTo: number }>;
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
        sessionId: payload.sessionId,
        bookletPages: payload.bookletPages,
      });
      message.success("Đã lưu bộ đề");
      setReviewOpen(false);
      resetImport();
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
      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <Upload.Dragger
          accept=".pdf,application/pdf"
          showUploadList={false}
          beforeUpload={(file) => {
            setBookletFile(file);
            return false;
          }}
          className="rounded-2xl!"
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon">
            <FilePdfOutlined className="text-slate-500!" />
          </p>
          <p className="ant-upload-text">File đề gốc (bộ đề scan)</p>
          <p className="ant-upload-hint">
            {bookletFile ? bookletFile.name : "PDF đề tiếng Anh — hiển thị dạng ảnh trang"}
          </p>
        </Upload.Dragger>

        <Upload.Dragger
          accept=".pdf,application/pdf"
          showUploadList={false}
          beforeUpload={(file) => {
            setKeyFile(file);
            return false;
          }}
          className="rounded-2xl!"
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined className="text-indigo-500!" />
          </p>
          <p className="ant-upload-text">File KEY (đáp án + giải thích)</p>
          <p className="ant-upload-hint">
            {keyFile ? keyFile.name : "PDF KEY Part 5–7 · đáp án và chữa tiếng Việt"}
          </p>
        </Upload.Dragger>
      </div>

      <div className="mb-5 flex justify-end">
        <Button
          type="primary"
          loading={uploading}
          disabled={!bookletFile || !keyFile}
          onClick={() => void handleAnalyze()}
        >
          Phân tích 2 file
        </Button>
      </div>

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
            sessionId={sessionId ?? undefined}
            initialBookletPages={bookletPages}
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
