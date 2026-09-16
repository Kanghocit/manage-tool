import { useMemo, useState } from "react";
import { Alert, Button, Form, Input, InputNumber, Select, Tabs, message } from "antd";

import { BookletPageImage } from "./BookletPageImage";
import type {
  CaseStudyBookletPageInput,
  CaseStudyParsePreview,
} from "../lib/caseStudyTypes";
import {
  suggestBookletPageRanges,
  uncoveredQuestionNumbers,
} from "../lib/caseStudyUtils";

type BookletPageDraft = CaseStudyBookletPageInput & { url: string };

type Props = {
  preview: CaseStudyParsePreview;
  sessionId?: string;
  initialBookletPages?: Array<{ pageIndex: number; url: string }>;
  saving: boolean;
  onCancel: () => void;
  onSave: (
    payload: CaseStudyParsePreview & {
      title: string;
      description: string;
      status: "draft" | "published";
      sessionId?: string;
      bookletPages?: CaseStudyBookletPageInput[];
    },
  ) => Promise<void>;
};

export function CaseStudyImportReview({
  preview,
  sessionId,
  initialBookletPages = [],
  saving,
  onCancel,
  onSave,
}: Props) {
  const [title, setTitle] = useState(preview.title);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [passages, setPassages] = useState(preview.passages);
  const [questions, setQuestions] = useState(preview.questions);
  const questionNumbers = useMemo(
    () => preview.questions.map((q) => q.number),
    [preview.questions],
  );
  const questionNumberSet = useMemo(() => new Set(questionNumbers), [questionNumbers]);

  const countMappedQuestions = (from: number, to: number) => {
    if (from <= 0 || to <= 0) return 0;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    let count = 0;
    for (let n = lo; n <= hi; n++) {
      if (questionNumberSet.has(n)) count += 1;
    }
    return count;
  };

  const [bookletPages, setBookletPages] = useState<BookletPageDraft[]>(() => {
    const drafts = initialBookletPages.map((p) => ({
      pageIndex: p.pageIndex,
      url: p.url,
      questionFrom: 0,
      questionTo: 0,
    }));
    const suggestions = suggestBookletPageRanges(drafts.length, questionNumbers);
    return drafts.map((p, i) => ({
      ...p,
      questionFrom: suggestions[i]?.questionFrom ?? 0,
      questionTo: suggestions[i]?.questionTo ?? 0,
    }));
  });

  const hasBooklet = bookletPages.length > 0;
  const questionRangeLabel = useMemo(() => {
    if (questionNumbers.length === 0) return "";
    const sorted = [...questionNumbers].sort((a, b) => a - b);
    return `${sorted[0]}–${sorted[sorted.length - 1]}`;
  }, [questionNumbers]);
  const emptyPassages = useMemo(
    () => passages.filter((p) => !p.contentEn.trim()).length,
    [passages],
  );
  const missingCoverage = useMemo(
    () => (hasBooklet ? uncoveredQuestionNumbers(bookletPages, questionNumbers) : []),
    [bookletPages, hasBooklet, questionNumbers],
  );
  const assignedCount = questionNumbers.length - missingCoverage.length;

  const applyEvenSplit = () => {
    const suggestions = suggestBookletPageRanges(bookletPages.length, questionNumbers);
    setBookletPages((prev) =>
      prev.map((p, i) => ({
        ...p,
        questionFrom: suggestions[i]?.questionFrom ?? 0,
        questionTo: suggestions[i]?.questionTo ?? 0,
      })),
    );
    message.success("Đã gợi ý chia đều — chỉnh lại theo từng trang đề");
  };

  const clearPageRanges = () => {
    setBookletPages((prev) =>
      prev.map((p) => ({ ...p, questionFrom: 0, questionTo: 0 })),
    );
  };

  const updateQuestion = (index: number, patch: Partial<(typeof questions)[0]>) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const updatePassage = (index: number, contentEn: string) => {
    setPassages((prev) => prev.map((p, i) => (i === index ? { ...p, contentEn } : p)));
  };

  const updatePassageVi = (index: number, contentVi: string) => {
    setPassages((prev) => prev.map((p, i) => (i === index ? { ...p, contentVi } : p)));
  };

  const updateBookletPage = (index: number, patch: Partial<BookletPageDraft>) => {
    setBookletPages((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      message.warning("Nhập tiêu đề");
      return;
    }
    if (questions.length === 0) {
      message.warning("Không có câu hỏi");
      return;
    }
    if (hasBooklet && status === "published" && missingCoverage.length > 0) {
      message.warning(
        `Chưa gán đủ câu ${questionRangeLabel} (thiếu ${missingCoverage.length} câu) — lưu Nháp hoặc gán trang trước khi đăng`,
      );
      return;
    }

    await onSave({
      title,
      description,
      status,
      passages,
      questions,
      warnings: preview.warnings,
      ...(sessionId && hasBooklet
        ? {
            sessionId,
            bookletPages: bookletPages.map(({ pageIndex, questionFrom, questionTo }) => ({
              pageIndex,
              questionFrom,
              questionTo,
            })),
          }
        : {}),
    });
  };

  const tabItems = [
    ...(hasBooklet
      ? [
          {
            key: "booklet",
            label: `Đề gốc (${bookletPages.length} trang)`,
            children: (
              <div style={{ maxHeight: "55vh", overflow: "auto" }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Button size="small" onClick={applyEvenSplit}>
                    Gợi ý chia đều
                  </Button>
                  <Button size="small" onClick={clearPageRanges}>
                    Xóa gán
                  </Button>
                  <span style={{ fontSize: 12, color: "var(--study-muted)" }}>
                    {questionNumbers.length} câu ({questionRangeLabel}) · Đã gán{" "}
                    {assignedCount}/{questionNumbers.length}
                  </span>
                </div>
                {missingCoverage.length > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message={`Thiếu ${missingCoverage.length} câu chưa được gán trang`}
                    description={
                      <span style={{ fontSize: 12 }}>
                        Xem ảnh từng trang, chỉnh &quot;Câu từ / đến&quot; cho khớp đề in. Ví dụ
                        thiếu: {missingCoverage.slice(0, 12).join(", ")}
                        {missingCoverage.length > 12 ? "…" : ""}
                      </span>
                    }
                  />
                )}
                {bookletPages.map((page, i) => (
                  <div
                    key={page.pageIndex}
                    style={{
                      border: "1px solid var(--study-border)",
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ fontSize: 12, marginBottom: 8, color: "var(--study-muted)" }}>
                      Trang {page.pageIndex + 1}
                    </div>
                    <BookletPageImage
                      url={page.url}
                      alt={`Trang ${page.pageIndex + 1}`}
                      style={{ marginBottom: 10 }}
                    />
                    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12 }}>Câu từ</span>
                      <InputNumber
                        min={1}
                        max={999}
                        value={page.questionFrom || undefined}
                        placeholder="101"
                        onChange={(v) => updateBookletPage(i, { questionFrom: v ?? 0 })}
                      />
                      <span style={{ fontSize: 12 }}>đến</span>
                      <InputNumber
                        min={1}
                        max={999}
                        value={page.questionTo || undefined}
                        placeholder="130"
                        onChange={(v) => updateBookletPage(i, { questionTo: v ?? 0 })}
                      />
                      {page.questionFrom > 0 && page.questionTo > 0 && (
                        <span style={{ fontSize: 11, color: "var(--study-muted)" }}>
                          ({countMappedQuestions(page.questionFrom, page.questionTo)} câu)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ),
          },
        ]
      : []),
    {
      key: "questions",
      label: `Câu hỏi (${questions.length})`,
      children: (
        <div style={{ maxHeight: "55vh", overflow: "auto" }}>
          {questions.map((q, i) => (
            <div
              key={`${q.number}-${i}`}
              style={{
                border: "1px solid var(--study-border)",
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--study-muted)", marginBottom: 6 }}>
                Part {q.part} · Câu {q.number} · Đáp án {q.correctKey}
                {"answerUncertain" in q && q.answerUncertain && (
                  <span style={{ color: "#f97316", marginLeft: 8 }}>
                    — cần chọn đáp án thủ công
                  </span>
                )}
              </div>
              {"answerUncertain" in q && q.answerUncertain && (
                <Select
                  value={q.correctKey}
                  style={{ width: 120, marginBottom: 8 }}
                  onChange={(v) => updateQuestion(i, { correctKey: v, answerUncertain: false })}
                  options={["A", "B", "C", "D"].map((k) => ({ value: k, label: `Đáp án ${k}` }))}
                />
              )}
              <Input.TextArea
                value={q.stemEn}
                onChange={(e) => updateQuestion(i, { stemEn: e.target.value })}
                rows={2}
                style={{ marginBottom: 8, fontFamily: "monospace", fontSize: 12 }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {q.options.map((opt, oi) => (
                  <Input
                    key={opt.key}
                    addonBefore={opt.key}
                    value={opt.textEn}
                    onChange={(e) => {
                      const next = [...q.options];
                      next[oi] = { ...opt, textEn: e.target.value };
                      updateQuestion(i, { options: next });
                    }}
                  />
                ))}
              </div>
              <Input.TextArea
                value={q.explanationVi}
                onChange={(e) => updateQuestion(i, { explanationVi: e.target.value })}
                rows={3}
                placeholder="Giải thích tiếng Việt"
                style={{ marginTop: 8, fontSize: 12 }}
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "passages",
      label: `Đoạn đọc (${passages.length})`,
      children: (
        <div style={{ maxHeight: "55vh", overflow: "auto" }}>
          {hasBooklet && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="Có ảnh đề gốc — đoạn đọc text chỉ để tham khảo khi duyệt"
            />
          )}
          {passages.map((p, i) => (
            <div key={p.label} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                Part {p.part} · {p.label} · Câu {p.questionNumbers.join(", ")}
              </div>
              {!hasBooklet && (
                <>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                    Đoạn tiếng Anh (hiển thị khi luyện tập)
                  </div>
                  <Input.TextArea
                    value={p.contentEn}
                    onChange={(e) => updatePassage(i, e.target.value)}
                    rows={5}
                    placeholder="Dán đoạn đọc tiếng Anh — PDF KEY thường chỉ có bản dịch"
                    style={{ fontFamily: "monospace", fontSize: 12 }}
                  />
                </>
              )}
              {(p.contentVi ?? "").trim() && (
                <>
                  <div style={{ fontSize: 11, color: "#64748b", margin: "8px 0 4px" }}>
                    Bản dịch tham khảo (không hiện khi luyện tập)
                  </div>
                  <Input.TextArea
                    value={p.contentVi ?? ""}
                    onChange={(e) => updatePassageVi(i, e.target.value)}
                    rows={4}
                    style={{ fontFamily: "monospace", fontSize: 12, background: "#f8fafc" }}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div>
      {preview.warnings.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`${preview.warnings.length} cảnh báo`}
          description={
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
              {preview.warnings.slice(0, 6).map((w) => (
                <li key={w}>{w}</li>
              ))}
              {preview.warnings.length > 6 && <li>…</li>}
            </ul>
          }
        />
      )}

      <Form layout="vertical" style={{ marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 12 }}>
          <Form.Item label="Tiêu đề" required style={{ marginBottom: 0 }}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Form.Item>
          <Form.Item label="Mô tả" style={{ marginBottom: 0 }}>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Form.Item>
          <Form.Item label="Trạng thái" style={{ marginBottom: 0 }}>
            <Select
              value={status}
              onChange={setStatus}
              options={[
                { value: "draft", label: "Nháp" },
                { value: "published", label: "Đăng ngay" },
              ]}
            />
          </Form.Item>
        </div>
      </Form>

      {!hasBooklet && emptyPassages > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={`${emptyPassages} đoạn đọc thiếu tiếng Anh — dán nội dung trước khi đăng`}
        />
      )}

      <Tabs items={tabItems} defaultActiveKey={hasBooklet ? "booklet" : "questions"} />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Button onClick={onCancel}>Huỷ</Button>
        <Button type="primary" loading={saving} onClick={() => void handleSave()}>
          Lưu bộ đề
        </Button>
      </div>
    </div>
  );
}
