import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { App as AntApp, Button, Empty, Form, Input, Modal, Spin, message } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";

import { createList, deleteList, fetchManageLists } from "../lib/studyApi";
import { studyKeys } from "../lib/queryKeys";
import type { StudyList } from "../lib/types";

export function ManageLists() {
  const { modal } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data: lists = [], isLoading } = useQuery({
    queryKey: studyKeys.manageLists,
    queryFn: async () => {
      try {
        return await fetchManageLists();
      } catch {
        message.error("Không tải được danh sách");
        throw new Error("fetch failed");
      }
    },
  });

  const refreshLists = () =>
    queryClient.invalidateQueries({ queryKey: studyKeys.manageLists });

  const handleCreate = async () => {
    const values = await form.validateFields();
    await createList(values.title, values.description ?? "");
    message.success("Đã tạo list");
    setModalOpen(false);
    form.resetFields();
    await refreshLists();
  };

  const handleDelete = (list: StudyList) => {
    modal.confirm({
      title: "Xoá list này?",
      content: (
        <span>
          <strong>{list.title}</strong>
          {list.source === "seed"
            ? " — list hệ thống sẽ được ẩn khỏi danh sách của bạn."
            : " — toàn bộ từ trong list sẽ bị xoá."}
        </span>
      ),
      okText: "Xoá",
      okButtonProps: { danger: true },
      cancelText: "Huỷ",
      onOk: async () => {
        try {
          const result = await deleteList(list.id);
          message.success(result.message);
          await refreshLists();
        } catch {
          message.error("Không xoá được list. Thử đăng nhập lại.");
        }
      },
    });
  };

  if (isLoading && lists.length === 0) {
    return (
      <div className="study-center-loading">
        <Spin />
      </div>
    );
  }

  return (
    <div>
      <nav className="study-breadcrumb">
        <Link to="/study">Luyện tập</Link>
        <span> / Quản lý list</span>
      </nav>
      <div className="study-page-head">
        <div>
          <h1 className="study-page-title">Quản lý list</h1>
          <p className="study-page-subtitle">
            Tạo, chỉnh sửa và import từ vựng cho từng bộ list.
          </p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
        >
          Tạo list
        </Button>
      </div>

      {lists.length === 0 ? (
        <div className="study-card study-empty-wrap">
          <Empty
            description="Chưa có list nào"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={() => setModalOpen(true)}>
              Tạo list đầu tiên
            </Button>
          </Empty>
        </div>
      ) : (
        <div className="study-card study-manage-table">
          <div className="study-manage-table-head">
            <span>Tên list</span>
            <span className="study-manage-col-count">Số từ</span>
            <span className="study-manage-col-actions">Thao tác</span>
          </div>
          <ul className="study-manage-table-body">
            {lists.map((list) => (
              <li key={list.id} className="study-manage-row">
                <Link
                  to={`/study/manage/${list.id}`}
                  className="study-manage-row-main"
                >
                  <span className="study-manage-row-title">{list.title}</span>
                  {list.description ? (
                    <span className="study-manage-row-desc">{list.description}</span>
                  ) : null}
                </Link>
                <span className="study-manage-col-count">{list.wordCount} từ</span>
                <div className="study-manage-col-actions">
                  <Link to={`/study/manage/${list.id}`}>
                    <Button type="text" size="small" icon={<EditOutlined />}>
                      Sửa
                    </Button>
                  </Link>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(list)}
                  >
                    Xoá
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        title="Tạo list mới"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleCreate()}
        okText="Tạo"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="Tên list"
            rules={[{ required: true, message: "Nhập tên list" }]}
          >
            <Input placeholder="VD: TOEIC 600 — Week 1" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả ngắn (tuỳ chọn)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
