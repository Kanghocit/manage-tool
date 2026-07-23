import {
  App as AntApp,
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
} from "antd";
import { PageContainer, ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { DeleteOutlined, EditOutlined, PlusOutlined, ThunderboltOutlined, ChromeOutlined } from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ActionType } from "@ant-design/pro-components";
import dayjs from "dayjs";

import { api } from "../../../lib/api";
import type { BrowserProfile } from "../../../types/automation";
import { ProfilePreviewModal } from "./ProfilePreviewModal";

type ProfileForm = {
  name: string;
  userAgent?: string;
  proxyUrl?: string;
  viewportWidth?: number;
  viewportHeight?: number;
};

type BulkForm = {
  count: number;
  namePrefix: string;
  proxyList?: string;
  randomizeFingerprint: boolean;
};

async function fetchProfiles(params: {
  page: number;
  limit: number;
  keyword?: string;
}) {
  const { data } = await api.get<{
    success: boolean;
    items: BrowserProfile[];
    total: number;
  }>("/api/admin/browser-profiles", { params });
  return data;
}

export function BrowserProfilesPage() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const actionRef = useRef<ActionType>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [previewProfile, setPreviewProfile] = useState<BrowserProfile | null>(null);
  const [editing, setEditing] = useState<BrowserProfile | null>(null);
  const [form] = Form.useForm<ProfileForm>();
  const [bulkForm] = Form.useForm<BulkForm>();

  const saveMut = useMutation({
    mutationFn: (values: ProfileForm) => {
      if (editing) {
        return api.put(`/api/admin/browser-profiles/${editing.id}`, values);
      }
      return api.post("/api/admin/browser-profiles", values);
    },
    onSuccess: () => {
      message.success(
        editing
          ? t("automationProfiles.updated")
          : t("automationProfiles.created"),
      );
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["browser-profiles"] });
      void queryClient.invalidateQueries({ queryKey: ["browser-profiles-all"] });
      actionRef.current?.reload();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/browser-profiles/${id}`),
    onSuccess: () => {
      message.success(t("automationProfiles.deleted"));
      void queryClient.invalidateQueries({ queryKey: ["browser-profiles"] });
      void queryClient.invalidateQueries({ queryKey: ["browser-profiles-all"] });
      actionRef.current?.reload();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const bulkMut = useMutation({
    mutationFn: (values: BulkForm) =>
      api.post<{ success: boolean; count: number }>(
        "/api/admin/browser-profiles/bulk-generate",
        values,
      ),
    onSuccess: (res) => {
      message.success(
        t("automationProfiles.bulkCreated", { count: res.data.count }),
      );
      setBulkOpen(false);
      bulkForm.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["browser-profiles"] });
      void queryClient.invalidateQueries({ queryKey: ["browser-profiles-all"] });
      actionRef.current?.reload();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (profile: BrowserProfile) => {
    setEditing(profile);
    form.setFieldsValue({
      name: profile.name,
      userAgent: profile.userAgent ?? undefined,
      proxyUrl: profile.proxyUrl ?? undefined,
      viewportWidth: profile.viewportWidth ?? undefined,
      viewportHeight: profile.viewportHeight ?? undefined,
    });
    setModalOpen(true);
  };

  const columns: ProColumns<BrowserProfile>[] = [
    { title: t("automationProfiles.name"), dataIndex: "name" },
    {
      title: t("automationProfiles.userAgent"),
      dataIndex: "userAgent",
      ellipsis: true,
      search: false,
    },
    {
      title: t("automationProfiles.proxy"),
      dataIndex: "proxyUrl",
      ellipsis: true,
      search: false,
    },
    {
      title: t("automationProfiles.viewport"),
      search: false,
      render: (_, row) =>
        row.viewportWidth && row.viewportHeight
          ? `${row.viewportWidth}×${row.viewportHeight}`
          : "—",
    },
    {
      title: t("automationTools.updatedAt"),
      dataIndex: "updatedAt",
      search: false,
      render: (_, row) => dayjs(row.updatedAt).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: t("automationTools.actions"),
      valueType: "option",
      render: (_, row) => [
        <Button
          key="preview"
          type="link"
          icon={<ChromeOutlined />}
          onClick={() => setPreviewProfile(row)}
        >
          {t("automationProfiles.preview")}
        </Button>,
        <Button
          key="edit"
          type="link"
          icon={<EditOutlined />}
          onClick={() => openEdit(row)}
        >
          {t("automationTools.edit")}
        </Button>,
        <Popconfirm
          key="delete"
          title={t("automationProfiles.deleteConfirm")}
          onConfirm={() => deleteMut.mutate(row.id)}
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            {t("automationTools.delete")}
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer
      title={t("automationProfiles.title")}
      extra={
        <Space>
          <Button icon={<ThunderboltOutlined />} onClick={() => setBulkOpen(true)}>
            {t("automationProfiles.bulkGenerate")}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t("automationProfiles.create")}
          </Button>
        </Space>
      }
    >
      <ProTable<BrowserProfile>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={{ labelWidth: "auto" }}
        request={async (params) => {
          const result = await fetchProfiles({
            page: params.current ?? 1,
            limit: params.pageSize ?? 20,
            keyword: params.name as string | undefined,
          });
          return {
            data: result.items,
            total: result.total,
            success: true,
          };
        }}
        pagination={{ defaultPageSize: 20 }}
      />

      <Modal
        open={modalOpen}
        title={
          editing
            ? t("automationProfiles.editTitle")
            : t("automationProfiles.createTitle")
        }
        okText={t("automationTools.save")}
        cancelText={t("common.close")}
        confirmLoading={saveMut.isPending}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => saveMut.mutate(values)}
        >
          <Form.Item
            name="name"
            label={t("automationProfiles.name")}
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="userAgent" label={t("automationProfiles.userAgent")}>
            <Input.TextArea rows={2} placeholder="Mozilla/5.0 ..." />
          </Form.Item>
          <Form.Item name="proxyUrl" label={t("automationProfiles.proxy")}>
            <Input placeholder="http://user:pass@host:port" />
          </Form.Item>
          <Space className="w-full" size="middle">
            <Form.Item
              name="viewportWidth"
              label={t("automationProfiles.width")}
              className="flex-1"
            >
              <InputNumber min={320} max={3840} className="w-full" />
            </Form.Item>
            <Form.Item
              name="viewportHeight"
              label={t("automationProfiles.height")}
              className="flex-1"
            >
              <InputNumber min={240} max={2160} className="w-full" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        open={bulkOpen}
        title={t("automationProfiles.bulkTitle")}
        okText={t("automationProfiles.bulkGenerate")}
        cancelText={t("common.close")}
        confirmLoading={bulkMut.isPending}
        onCancel={() => {
          setBulkOpen(false);
          bulkForm.resetFields();
        }}
        onOk={() => bulkForm.submit()}
        destroyOnClose
      >
        <Form
          form={bulkForm}
          layout="vertical"
          initialValues={{
            count: 5,
            namePrefix: "Profile",
            randomizeFingerprint: true,
          }}
          onFinish={(values) => bulkMut.mutate(values)}
        >
          <Form.Item
            name="count"
            label={t("automationProfiles.bulkCount")}
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={50} className="w-full" />
          </Form.Item>
          <Form.Item
            name="namePrefix"
            label={t("automationProfiles.bulkPrefix")}
            rules={[{ required: true }]}
          >
            <Input placeholder="Profile" />
          </Form.Item>
          <Form.Item name="proxyList" label={t("automationProfiles.bulkProxyList")}>
            <Input.TextArea
              rows={4}
              placeholder={t("automationProfiles.bulkProxyPlaceholder")}
            />
          </Form.Item>
          <Form.Item name="randomizeFingerprint" valuePropName="checked">
            <Checkbox>{t("automationProfiles.bulkRandomize")}</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <ProfilePreviewModal
        open={!!previewProfile}
        profile={previewProfile}
        onClose={() => setPreviewProfile(null)}
      />
    </PageContainer>
  );
}
