import { Tag } from "antd";
import { PageContainer, ProTable } from "@ant-design/pro-components";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { mockApi } from "../../lib/mock-api";
import { useAuthStore } from "../../store/useAuthStore";

export function MyToolsPage() {
  const authUser = useAuthStore((state) => state.user);
  const { t } = useTranslation();

  const myToolsQuery = useQuery({
    queryKey: ["my-tools", authUser?.id],
    queryFn: () => mockApi.getMyTools(authUser?.id ?? ""),
    enabled: Boolean(authUser?.id),
  });

  return (
    <PageContainer title={t("menu.myTools")} subTitle={t("pages.myToolsSubtitle")}>
      <ProTable
        rowKey="id"
        search={false}
        loading={myToolsQuery.isLoading}
        dataSource={myToolsQuery.data ?? []}
        pagination={false}
        columns={[
          {
            title: t("common.tool"),
            render: (_, record) => record.tool?.name ?? t("common.unknown"),
          },
          {
            title: t("common.description"),
            render: (_, record) => record.tool?.description ?? "-",
          },
          {
            title: t("common.expires"),
            render: (_, record) => dayjs(record.endAt).format("DD/MM/YYYY HH:mm"),
          },
          {
            title: t("common.status"),
            render: () => <Tag color="green">{t("common.active")}</Tag>,
          },
        ]}
      />
    </PageContainer>
  );
}

