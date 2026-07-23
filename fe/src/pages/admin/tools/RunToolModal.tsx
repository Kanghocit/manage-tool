import { App as AntApp, Form, InputNumber, Modal, Select } from "antd";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { api } from "../../../lib/api";
import type { AutomationTool, BrowserProfile } from "../../../types/automation";

type Props = {
  open: boolean;
  tool: AutomationTool | null;
  profiles: BrowserProfile[];
  onClose: () => void;
};

type RunForm = {
  profileIds: string[];
  loopCount: number;
};

export function RunToolModal({ open, tool, profiles, onClose }: Props) {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<RunForm>();

  const runMut = useMutation({
    mutationFn: (values: RunForm) =>
      api.post<{ success: boolean; run: { id: string } }>(
        `/api/admin/tools/${tool!.id}/run`,
        values,
      ),
    onSuccess: (res) => {
      message.success(t("automationTools.runStarted"));
      onClose();
      navigate(`/admin/tools/runs/${res.data.run.id}`);
    },
    onError: (e: Error) => message.error(e.message),
  });

  return (
    <Modal
      open={open}
      title={t("automationTools.runTitle", { name: tool?.name ?? "" })}
      okText={t("automationTools.run")}
      cancelText={t("common.close")}
      confirmLoading={runMut.isPending}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      onOk={() => form.submit()}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          loopCount: tool?.defaultLoopCount ?? 1,
          profileIds: [],
        }}
        onFinish={(values) => runMut.mutate(values)}
      >
        <Form.Item
          name="profileIds"
          label={t("automationTools.selectProfiles")}
          rules={[
            {
              required: true,
              message: t("automationTools.profileRequired"),
            },
          ]}
        >
          <Select
            mode="multiple"
            placeholder={t("automationTools.selectProfilesPlaceholder")}
            options={profiles.map((p) => ({ label: p.name, value: p.id }))}
          />
        </Form.Item>
        <Form.Item
          name="loopCount"
          label={t("automationTools.loopCount")}
          rules={[{ required: true }]}
        >
          <InputNumber min={1} max={10000} className="w-full" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
