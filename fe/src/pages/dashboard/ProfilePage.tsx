import { Statistic, Tag } from "antd";
import {
  PageContainer,
  ProCard,
  ProDescriptions,
} from "@ant-design/pro-components";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/useAuthStore";

export function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const { t } = useTranslation();

  return (
    <PageContainer title={t("pages.profileTitle")}>
      <div className="grid grid-equal-rows gap-4 lg:grid-cols-2">
        <ProCard bordered className="h-full">
          <Statistic
            title={t("fields.fullName")}
            value={user?.fullName ?? "-"}
          />
        </ProCard>
        <ProCard bordered className="h-full">
          <Statistic
            title={t("fields.role")}
            value={user?.role === "admin" ? t("roles.admin") : t("roles.user")}
          />
        </ProCard>
      </div>

      <ProCard bordered title={t("pages.accountDetails")} className="mt-4!">
        <ProDescriptions
          column={1}
          dataSource={{
            email: user?.email,
            status: user?.status,
            role: user?.role,
          }}
          columns={[
            { title: "Email", dataIndex: "email" },
            {
              title: t("common.status"),
              dataIndex: "status",
              render: (_, row) => (
                <Tag color="green">
                  {row.status === "active"
                    ? t("common.active")
                    : t("common.inactive")}
                </Tag>
              ),
            },
            {
              title: t("fields.role"),
              dataIndex: "role",
              render: (_, row) =>
                row.role === "admin" ? t("roles.admin") : t("roles.user"),
            },
          ]}
        />
      </ProCard>
    </PageContainer>
  );
}
