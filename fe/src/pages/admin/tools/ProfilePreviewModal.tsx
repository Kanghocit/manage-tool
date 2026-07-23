import { App as AntApp, Form, Input, Modal, Space, Typography } from "antd";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../../lib/api";
import type { BrowserProfile } from "../../../types/automation";

export type ProfilePreview = {
  id: string;
  profileId: string;
  profileName: string;
  url: string;
  headed: boolean;
  startedAt: string;
};

type Props = {
  open: boolean;
  profile: BrowserProfile | null;
  onClose: () => void;
};

type PreviewForm = {
  url: string;
};

export function ProfilePreviewModal({ open, profile, onClose }: Props) {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<PreviewForm>();
  const [preview, setPreview] = useState<ProfilePreview | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  const openMut = useMutation({
    mutationFn: (values: PreviewForm) =>
      api.post<{ success: boolean; preview: ProfilePreview }>(
        `/api/admin/browser-profiles/${profile!.id}/preview`,
        values,
      ),
    onSuccess: (res) => {
      message.success(t("automationProfiles.previewStarted"));
      setPreview(res.data.preview);
    },
    onError: (e: Error) => message.error(e.message),
  });

  const closeMut = useMutation({
    mutationFn: (previewId: string) =>
      api.post(`/api/admin/browser-profiles/previews/${previewId}/close`, {}),
    onSuccess: () => {
      message.success(t("automationProfiles.previewClosed"));
      setPreview(null);
      onClose();
    },
    onError: (e: Error) => message.error(e.message),
  });

  useEffect(() => {
    if (!open) {
      setPreview(null);
      form.resetFields();
    }
  }, [open, form]);

  useEffect(() => {
    if (!preview || preview.headed) {
      setScreenshotUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const loadScreenshot = async () => {
      try {
        const { data } = await api.get<Blob>(
          `/api/admin/browser-profiles/previews/${preview.id}/screenshot`,
          { responseType: "blob" },
        );
        if (cancelled) return;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(data);
        setScreenshotUrl(objectUrl);
      } catch {
        if (!cancelled) setScreenshotUrl(null);
      }
    };

    void loadScreenshot();
    const timer = setInterval(loadScreenshot, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [preview]);

  const handleClose = () => {
    if (preview) {
      closeMut.mutate(preview.id);
    } else {
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      title={t("automationProfiles.previewTitle", { name: profile?.name ?? "" })}
      okText={preview ? t("automationProfiles.previewClose") : t("automationProfiles.previewOpen")}
      cancelText={t("common.close")}
      confirmLoading={openMut.isPending || closeMut.isPending}
      onCancel={handleClose}
      onOk={() => {
        if (preview) {
          closeMut.mutate(preview.id);
        } else {
          form.submit();
        }
      }}
      width={preview && !preview.headed ? 900 : 520}
      destroyOnClose
    >
      {!preview ? (
        <Form
          form={form}
          layout="vertical"
          initialValues={{ url: "https://www.google.com" }}
          onFinish={(values) => openMut.mutate(values)}
        >
          <Typography.Paragraph type="secondary" className="text-sm">
            {t("automationProfiles.previewHint")}
          </Typography.Paragraph>
          <Form.Item
            name="url"
            label={t("automationTools.url")}
            rules={[{ required: true, type: "url" }]}
          >
            <Input placeholder="https://www.google.com" />
          </Form.Item>
        </Form>
      ) : (
        <Space direction="vertical" className="w-full">
          <Typography.Text>
            {preview.headed
              ? t("automationProfiles.previewHeaded")
              : t("automationProfiles.previewHeadless")}
          </Typography.Text>
          <Typography.Text type="secondary" className="text-sm">
            {preview.url}
          </Typography.Text>
          {!preview.headed && screenshotUrl ? (
            <img
              src={screenshotUrl}
              alt="preview"
              className="max-h-[480px] w-full rounded border border-slate-200 object-contain"
            />
          ) : null}
        </Space>
      )}
    </Modal>
  );
}
