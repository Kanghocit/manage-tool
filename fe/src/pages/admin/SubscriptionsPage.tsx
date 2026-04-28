import { Tag } from "antd";
import {
  PageContainer,
  ProCard,
  ProForm,
  ProFormDateTimeRangePicker,
  ProFormSelect,
  ProTable,
} from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { mockApi } from "../../lib/mock-api";
import { useAuthStore } from "../../store/useAuthStore";

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const { t } = useTranslation();

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: mockApi.getUsers });
  const toolsQuery = useQuery({ queryKey: ["tools"], queryFn: mockApi.getTools });
  const subscriptionsQuery = useQuery({
    queryKey: ["subscriptions"],
    queryFn: mockApi.getSubscriptions,
  });

  const mutation = useMutation({
    mutationFn: (values: { userId: string; toolId: string; range: [dayjs.Dayjs, dayjs.Dayjs] }) =>
      mockApi.createSubscription({
        userId: values.userId,
        toolId: values.toolId,
        startAt: values.range[0].toISOString(),
        endAt: values.range[1].toISOString(),
        createdBy: authUser?.id ?? "system",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  return (
    <PageContainer title={t("pages.subscriptionManagement")}>
      <div className="grid grid-equal-rows gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ProCard bordered className="h-full" title={t("pages.activateToolForUser")}>
          <ProForm
            initialValues={{ range: [dayjs(), dayjs().add(30, "day")] }}
            submitter={{ searchConfig: { submitText: t("pages.activateOneMonth") } }}
            onFinish={async (values) => {
              mutation.mutate(values as { userId: string; toolId: string; range: [dayjs.Dayjs, dayjs.Dayjs] });
            }}
          >
            <ProFormSelect
              name="userId"
              label={t("common.user")}
              options={(usersQuery.data ?? [])
                .filter((user) => user.role === "user")
                .map((user) => ({ value: user.id, label: `${user.fullName} (${user.email})` }))}
              rules={[{ required: true }]}
            />
            <ProFormSelect
              name="toolId"
              label={t("common.tool")}
              options={(toolsQuery.data ?? []).map((tool) => ({ value: tool.id, label: tool.name }))}
              rules={[{ required: true }]}
            />
            <ProFormDateTimeRangePicker name="range" label={t("pages.activeRange")} rules={[{ required: true }]} />
          </ProForm>
        </ProCard>

        <ProTable
          cardBordered
          rowKey="id"
          search={false}
          loading={subscriptionsQuery.isLoading}
          dataSource={subscriptionsQuery.data ?? []}
          pagination={false}
          columns={[
            {
              title: t("common.user"),
              render: (_, record) =>
                usersQuery.data?.find((user) => user.id === record.userId)?.fullName ?? record.userId,
            },
            {
              title: t("common.tool"),
              render: (_, record) =>
                toolsQuery.data?.find((tool) => tool.id === record.toolId)?.name ?? record.toolId,
            },
            {
              title: t("common.period"),
              render: (_, record) =>
                `${dayjs(record.startAt).format("DD/MM/YYYY")} - ${dayjs(record.endAt).format("DD/MM/YYYY")}`,
            },
            {
              title: t("common.status"),
              render: (_, record) => (
                <Tag color={record.status === "active" ? "green" : "default"}>
                  {record.status === "active" ? t("common.active") : t("common.expired")}
                </Tag>
              ),
            },
          ]}
        />
      </div>
    </PageContainer>
  );
}

