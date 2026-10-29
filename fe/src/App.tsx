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
          colorPrimary: "#2563eb",
          colorBgLayout: "#f8fafc",
          colorText: "#0f172a",
          colorTextSecondary: "#64748b",
          borderRadius: 12,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          controlHeight: 40,
        },
        components: {
          Button: { controlHeight: 40, paddingInline: 18 },
          Card: { borderRadiusLG: 16 },
          Table: { headerBg: "#f1f5f9" },
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
