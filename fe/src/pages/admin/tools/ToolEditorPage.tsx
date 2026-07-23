import { App as AntApp, Button, Card, Col, Form, Input, InputNumber, Row } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { PageContainer } from "@ant-design/pro-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../../../lib/api";
import {
  createDefaultStep,
  ensureNodeIds,
  type ToolNode,
} from "../../../types/automation";
import { ToolLogicEditor } from "./editor/ToolLogicEditor";

type ToolForm = {
  name: string;
  description?: string;
  defaultLoopCount: number;
};

export function ToolEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id && id !== "create");
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<ToolForm>();
  const [nodes, setNodes] = useState<ToolNode[]>([createDefaultStep("goto")]);

  const toolQuery = useQuery({
    queryKey: ["automation-tool", id],
    enabled: isEdit,
    queryFn: async () => {
      const { data } = await api.get<{
        success: boolean;
        tool: {
          name: string;
          description?: string;
          defaultLoopCount: number;
          steps: ToolNode[];
        };
      }>(`/api/admin/tools/${id}`);
      return data.tool;
    },
  });

  useEffect(() => {
    if (toolQuery.data) {
      form.setFieldsValue({
        name: toolQuery.data.name,
        description: toolQuery.data.description ?? "",
        defaultLoopCount: toolQuery.data.defaultLoopCount,
      });
      if (Array.isArray(toolQuery.data.steps) && toolQuery.data.steps.length) {
        setNodes(ensureNodeIds(toolQuery.data.steps));
      }
    }
  }, [toolQuery.data, form]);

  const saveMut = useMutation({
    mutationFn: async (values: ToolForm) => {
      const payload = { ...values, steps: nodes };
      if (isEdit) {
        return api.put(`/api/admin/tools/${id}`, payload);
      }
      return api.post("/api/admin/tools", payload);
    },
    onSuccess: () => {
      message.success(
        isEdit ? t("automationTools.updated") : t("automationTools.created"),
      );
      navigate("/admin/tools");
    },
    onError: (e: Error) => message.error(e.message),
  });

  return (
    <PageContainer
      title={
        isEdit ? t("automationTools.editTitle") : t("automationTools.createTitle")
      }
      loading={toolQuery.isLoading}
      onBack={() => navigate("/admin/tools")}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ defaultLoopCount: 1 }}
        onFinish={(values) => {
          if (nodes.length === 0) {
            message.error(t("automationTools.stepsRequired"));
            return;
          }
          saveMut.mutate(values);
        }}
      >
        <Card className="mb-4">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label={t("automationTools.name")}
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="defaultLoopCount"
                label={t("automationTools.defaultLoop")}
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={10000} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label={t("common.description")}>
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <ToolLogicEditor nodes={nodes} onChange={setNodes} />

        <Button
          type="primary"
          htmlType="submit"
          icon={<SaveOutlined />}
          loading={saveMut.isPending}
          className="mt-4"
        >
          {t("automationTools.save")}
        </Button>
      </Form>
    </PageContainer>
  );
}
