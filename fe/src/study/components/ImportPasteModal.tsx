import { useMemo, useState } from "react";
import { Alert, Input, Modal, message } from "antd";

import { importWordsFromPaste } from "../lib/studyApi";
import { parseVocabularyPaste } from "../lib/parseVocabularyPaste";

type Props = {
  listId: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

export function ImportPasteModal({ listId, open, onClose, onImported }: Props) {
  const [rawText, setRawText] = useState("");
  const [importing, setImporting] = useState(false);

  const preview = useMemo(() => parseVocabularyPaste(rawText), [rawText]);

  const handleImport = async () => {
    if (!preview.words.length) {
      message.warning("Không có từ hợp lệ để import");
      return;
    }
    setImporting(true);
    try {
      const result = await importWordsFromPaste(listId, rawText);
      message.success(`Đã thêm ${result.imported} từ`);
      if (result.errors.length) {
        message.warning(`${result.errors.length} block bị lỗi, bỏ qua`);
      }
      setRawText("");
      onImported();
      onClose();
    } catch {
      message.error("Import thất bại");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      title="Import từ copy/paste"
      open={open}
      onCancel={onClose}
      onOk={() => void handleImport()}
      okText={`Import ${preview.words.length} từ`}
      cancelText="Huỷ"
      confirmLoading={importing}
      okButtonProps={{ disabled: preview.words.length === 0 }}
      width={720}
      destroyOnClose
    >
      <p style={{ fontSize: 13, color: "var(--study-muted)", marginBottom: 8 }}>
        Dán nội dung định dạng STUDY4: từ (pos) IPA → Định nghĩa → Ví dụ với{" "}
        <code>[word]</code> và <code>(=Dịch: ...)</code>
      </p>
      <Input.TextArea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder={`accountant (n) /əˈkaʊn.tənt/\n UK\n US\nĐịnh nghĩa:\n...\n=a person...\nVí dụ:\n My [accountant] ... (=Dịch: ...)`}
        rows={10}
        style={{ fontSize: 13, fontFamily: "ui-monospace, monospace" }}
      />

      {preview.words.length > 0 && (
        <Alert
          type="success"
          showIcon
          style={{ marginTop: 10 }}
          message={`Nhận dạng ${preview.words.length} từ`}
          description={
            <span style={{ fontSize: 12 }}>
              {preview.words
                .slice(0, 8)
                .map((w) => w.word)
                .join(", ")}
              {preview.words.length > 8 ? "…" : ""}
            </span>
          }
        />
      )}

      {preview.errors.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 10 }}
          message={`${preview.errors.length} block lỗi`}
          description={
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
              {preview.errors.slice(0, 5).map((e) => (
                <li key={`${e.block}-${e.snippet}`}>
                  #{e.block}: {e.message}
                </li>
              ))}
            </ul>
          }
        />
      )}
    </Modal>
  );
}
