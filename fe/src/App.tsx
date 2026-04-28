import { App as AntApp, ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import viVN from "antd/locale/vi_VN";
import { ProConfigProvider, enUSIntl, viVNIntl } from "@ant-design/pro-components";
import { useTranslation } from "react-i18next";

import { AppRoutes } from "./AppRoutes";

export default function App() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || i18n.language;

  return (
    <ConfigProvider
      locale={lang === "vi" ? viVN : enUS}
      theme={{
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 14,
        },
      }}
    >
      <ProConfigProvider intl={lang === "vi" ? viVNIntl : enUSIntl}>
        <AntApp>
          <AppRoutes />
        </AntApp>
      </ProConfigProvider>
    </ConfigProvider>
  );
}
