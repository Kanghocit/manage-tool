import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { App as AntApp, Button, Form, Input, Modal, Spin, message } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  ImportOutlined,
  MinusCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";

import {
  createWord,
  deleteList,
  deleteWord,
  fetchStudyList,
  updateList,
  updateWord,
} from "../lib/studyApi";
import type { StudyWord } from "../lib/types";
import { ImportPasteModal } from "./ImportPasteModal";

type WordFormValues = {
  word: string;
  pos: string;
  ipa?: string;
  definitionVi: string;
  definitionEn: string;
  imageEmoji?: string;
  examples: { en: string; vi: string }[];
};

export function ManageListDetail() {
  const { modal } = AntApp.useApp();
  const { listId = "" } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [listSource, setListSource] = useState<"seed" | "user">("user");
  const [words, setWords] = useState<StudyWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [metaForm] = Form.useForm();
  const [wordForm] = Form.useForm<WordFormValues>();
  const [wordModal, setWordModal] = useState<{
    open: boolean;
    editing?: StudyWord;
  }>({
    open: false,
  });
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await fetchStudyList(listId);
      setTitle(detail.list.title);
      setDescription(detail.list.description);
      setListSource(detail.list.source);
      setWords(detail.words);
      metaForm.setFieldsValue({
        title: detail.list.title,
        description: detail.list.description,
      });
    } catch {
      message.error("Không tải được list");
    } finally {
      setLoading(false);
    }
  }, [listId, metaForm]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const saveMeta = async () => {
    const values = await metaForm.validateFields();
    await updateList(listId, values);
    setTitle(values.title);
    setDescription(values.description ?? "");
    message.success("Đã lưu thông tin list");
  };

  const openAddWord = () => {
    wordForm.resetFields();
    wordForm.setFieldsValue({
      examples: [{ en: "I need to _____ today.", vi: "Ví dụ tiếng Việt" }],
      imageEmoji: "📖",
    });
    setWordModal({ open: true });
  };

  const openEditWord = (word: StudyWord) => {
    wordForm.setFieldsValue({
      word: word.word,
      pos: word.pos,
      ipa: word.ipa,
      definitionVi: word.definitionVi,
      definitionEn: word.definitionEn,
      imageEmoji: word.imageEmoji,
      examples: word.examples.length ? word.examples : [{ en: "", vi: "" }],
    });
    setWordModal({ open: true, editing: word });
  };

  const saveWord = async () => {
    const values = await wordForm.validateFields();
    if (!values.examples?.length) {
      message.warning("Cần ít nhất 1 ví dụ");
      return;
    }
    const missingBlank = values.examples.some((ex) => !ex.en.includes("_____"));
    if (missingBlank) {
      message.warning('Ví dụ EN nên có "_____" làm chỗ trống');
    }
    const payload = {
      word: values.word,
      pos: values.pos,
      ipa: values.ipa ?? "",
      definitionVi: values.definitionVi,
      definitionEn: values.definitionEn,
      examples: values.examples,
      imageEmoji: values.imageEmoji ?? "📖",
    };
    if (wordModal.editing) {
      await updateWord(listId, wordModal.editing.id, payload);
      message.success("Đã cập nhật từ");
    } else {
      await createWord(listId, payload);
      message.success("Đã thêm từ");
    }
    setWordModal({ open: false });
    await load();
  };

  const handleDeleteList = () => {
    modal.confirm({
      title: "Xoá list này?",
      content:
        listSource === "seed"
          ? "List hệ thống sẽ được ẩn khỏi tài khoản của bạn."
          : "Toàn bộ từ trong list sẽ bị xoá vĩnh viễn.",
      okText: "Xoá",
      okButtonProps: { danger: true },
      cancelText: "Huỷ",
      onOk: async () => {
        try {
          const result = await deleteList(listId);
          message.success(result.message);
          navigate("/study/manage");
        } catch {
          message.error("Không xoá được list");
        }
      },
    });
  };

  const handleDeleteWord = (word: StudyWord) => {
    modal.confirm({
      title: "Xoá từ?",
      content: word.word,
      okText: "Xoá",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteWord(listId, word.id);
          message.success("Đã xoá từ");
          await load();
        } catch {
          message.error("Không xoá được từ");
        }
      },
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div>
      <nav className="study-breadcrumb">
        <Link to="/study">Luyện tập</Link>
        <Link to="/study/manage"> / Quản lý</Link>
        <span> / {title}</span>
      </nav>

      <section
        className="study-card"
        style={{ marginTop: 10, marginBottom: 12 }}
      >
        <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>{title}</h2>
        <Form form={metaForm} layout="vertical">
          <Form.Item name="title" label="Tên list" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button type="primary" onClick={() => void saveMeta()}>
              Lưu thông tin list
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => void handleDeleteList()}
            >
              Xoá list
            </Button>
          </div>
        </Form>
        {description && (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 12,
              color: "var(--study-muted)",
            }}
          >
            {description}
          </p>
        )}
      </section>

      <div className="study-toolbar">
        <h3 style={{ margin: 0, fontSize: 15 }}>Từ vựng ({words.length})</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
            Import
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddWord}>
            Thêm từ
          </Button>
        </div>
      </div>

      <section className="study-card">
        {words.map((w) => (
          <div key={w.id} className="study-word-row">
            <div>
              <strong>{w.word}</strong>
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 12,
                  color: "var(--study-muted)",
                }}
              >
                {w.pos}
              </span>
              <div style={{ fontSize: 13, marginTop: 4 }}>{w.definitionVi}</div>
            </div>
            <div className="study-manage-col-actions">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEditWord(w)}
              >
                Sửa
              </Button>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteWord(w)}
              >
                Xoá
              </Button>
            </div>
          </div>
        ))}
      </section>

      <ImportPasteModal
        listId={listId}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => void load()}
      />

      <Modal
        title={wordModal.editing ? "Sửa từ" : "Thêm từ"}
        open={wordModal.open}
        onCancel={() => setWordModal({ open: false })}
        onOk={() => void saveWord()}
        okText="Lưu"
        cancelText="Huỷ"
        width={520}
        destroyOnClose
      >
        <Form form={wordForm} layout="vertical">
          <Form.Item name="word" label="Từ" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="pos" label="Loại từ" rules={[{ required: true }]}>
            <Input placeholder="n, v, adj..." />
          </Form.Item>
          <Form.Item name="ipa" label="IPA">
            <Input />
          </Form.Item>
          <Form.Item
            name="definitionVi"
            label="Nghĩa VI"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="definitionEn"
            label="Nghĩa EN"
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="imageEmoji" label="Emoji">
            <Input maxLength={4} />
          </Form.Item>
          <Form.List name="examples">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <div
                    key={key}
                    style={{
                      marginBottom: 8,
                      padding: 10,
                      background: "#f8fafc",
                      borderRadius: 10,
                    }}
                  >
                    <Form.Item
                      {...rest}
                      name={[name, "en"]}
                      label="Ví dụ EN"
                      rules={[{ required: true }]}
                    >
                      <Input placeholder="Use _____ as blank" />
                    </Form.Item>
                    <Form.Item
                      {...rest}
                      name={[name, "vi"]}
                      label="Ví dụ VI"
                      rules={[{ required: true }]}
                    >
                      <Input />
                    </Form.Item>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(name)}
                        style={{
                          border: "none",
                          background: "none",
                          color: "#dc2626",
                        }}
                      >
                        <MinusCircleOutlined /> Xoá ví dụ
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="study-btn study-btn-secondary study-btn-block"
                  onClick={() => add({ en: "", vi: "" })}
                >
                  <PlusOutlined /> Thêm ví dụ
                </button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
