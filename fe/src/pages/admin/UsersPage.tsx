import { Select, Tag } from "antd";
import { PageContainer, ProTable } from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { mockApi } from "../../lib/mock-api";
import type { Role } from "../../store/useAuthStore";

export function UsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: mockApi.getUsers });
  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      mockApi.updateUserRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <PageContainer title={t("menu.users")}>
      <ProTable
        rowKey="id"
        search={false}
        loading={usersQuery.isLoading}
        dataSource={usersQuery.data ?? []}
        pagination={false}
        columns={[
          { title: t("fields.fullName"), dataIndex: "fullName" },
          { title: "Email", dataIndex: "email", copyable: true },
          {
            title: t("fields.role"),
            render: (_, record) => (
              <Select
                value={record.role}
                style={{ width: 160 }}
                onChange={(value) => roleMutation.mutate({ userId: record.id, role: value })}
                options={[
                  { value: "admin", label: t("roles.admin") },
                  { value: "user", label: t("roles.user") },
                ]}
              />
            ),
          },
          {
            title: t("common.status"),
            render: (_, record) => (
              <Tag color={record.status === "active" ? "green" : "orange"}>
                {record.status === "active" ? t("common.active") : t("common.inactive")}
              </Tag>
            ),
          },
        ]}
      />
    </PageContainer>
  );
}

