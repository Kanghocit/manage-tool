import { Tag } from "antd";
import { PageContainer, ProCard, ProForm, ProFormText, ProTable } from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { mockApi } from "../../lib/mock-api";
import { useAuthStore } from "../../store/useAuthStore";

export function ToolsPage() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const { t } = useTranslation();

  const toolsQuery = useQuery({ queryKey: ["tools"], queryFn: mockApi.getTools });
  const mutation = useMutation({
    mutationFn: (values: { name: string; slug: string; description: string }) =>
      mockApi.createTool({
        ...values,
        status: "active",
        type: "playwright",
        createdBy: authUser?.id ?? "system",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tools"] }),
  });

  return (
    <PageContainer title={t("pages.toolManagement")}>
      <div className="grid grid-equal-rows gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <ProCard bordered className="h-full" title={t("pages.createTool")}>
          <ProForm
            submitter={{ searchConfig: { submitText: t("pages.saveTool") } }}
            onFinish={async (values) => {
              mutation.mutate(values as { name: string; slug: string; description: string });
            }}
          >
            <ProFormText name="name" label={t("pages.toolName")} rules={[{ required: true }]} />
            <ProFormText name="slug" label="Slug" rules={[{ required: true }]} />
            <ProFormText name="description" label={t("common.description")} rules={[{ required: true }]} />
          </ProForm>
        </ProCard>

        <ProTable
          cardBordered
          rowKey="id"
          search={false}
          loading={toolsQuery.isLoading}
          dataSource={toolsQuery.data ?? []}
          pagination={false}
          columns={[
            { title: t("pages.toolName"), dataIndex: "name" },
            { title: "Slug", dataIndex: "slug", copyable: true },
            { title: t("fields.type"), dataIndex: "type" },
            {
              title: t("common.status"),
              render: (_, record) => (
                <Tag color={record.status === "active" ? "green" : "default"}>
                  {record.status === "active" ? t("common.active") : t("common.inactive")}
                </Tag>
              ),
            },
          ]}
        />
      </div>
    </PageContainer>
  );
}

