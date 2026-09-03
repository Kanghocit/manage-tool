import { PageContainer } from "@ant-design/pro-components";
import { useTranslation } from "react-i18next";

import { SupportChatPanel } from "../../components/support/SupportChatPanel";

export function UserSupportPage() {
  const { t } = useTranslation();

  return (
    <PageContainer title={t("menu.userSupport")} subTitle={t("support.subtitle")}>
      <SupportChatPanel className="h-[calc(100vh-12rem)] min-h-[520px]" />
    </PageContainer>
  );
}
