import { Statistic } from "antd";
import { SafetyOutlined, TeamOutlined, ToolOutlined } from "@ant-design/icons";
import { PageContainer, ProCard } from "@ant-design/pro-components";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { mockApi } from "../../lib/mock-api";

export function OverviewPage() {
  const { t } = useTranslation();

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: mockApi.getUsers,
  });
  const toolsQuery = useQuery({
    queryKey: ["tools"],
    queryFn: mockApi.getTools,
  });
  const subscriptionsQuery = useQuery({
    queryKey: ["subscriptions"],
    queryFn: mockApi.getSubscriptions,
  });

  return (
    <PageContainer
      title={t("menu.overview")}
      subTitle={t("pages.overviewSubtitle")}
    >
      <div className="grid grid-equal-rows gap-4 lg:grid-cols-3">
        <ProCard bordered className="h-full">
          <Statistic
            title={t("menu.users")}
            value={usersQuery.data?.length ?? 0}
            prefix={<TeamOutlined />}
          />
        </ProCard>
        <ProCard bordered className="h-full">
          <Statistic
            title={t("menu.tools")}
            value={toolsQuery.data?.length ?? 0}
            prefix={<ToolOutlined />}
          />
        </ProCard>
        <ProCard bordered className="h-full mt-4">
          <Statistic
            title={t("pages.activeSubscriptions")}
            value={
              subscriptionsQuery.data?.filter(
                (item) => item.status === "active",
              ).length ?? 0
            }
            prefix={<SafetyOutlined />}
          />
        </ProCard>
      </div>

      <ProCard bordered title={t("pages.adminNotesTitle")} className="mt-4!">
        <ul className="list-disc space-y-2 pl-5 text-slate-600">
          <li>{t("pages.noteSubscription")}</li>
          <li>{t("pages.noteLocalStorage")}</li>
          <li>{t("pages.noteNextStep")}</li>
        </ul>
      </ProCard>
    </PageContainer>
  );
}
