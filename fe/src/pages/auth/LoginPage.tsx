import { App as AntApp, Button, Space, Statistic, Tag } from "antd";
import { LoginFormPage, ProCard, ProFormText } from "@ant-design/pro-components";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { mockApi } from "../../lib/mock-api";
import { useAuthStore } from "../../store/useAuthStore";

export function LoginPage() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const setSession = useAuthStore((state) => state.setSession);
  const { t } = useTranslation();

  const mutation = useMutation({
    mutationFn: (values: { email: string; password: string }) =>
      mockApi.login(values.email, values.password),
    onSuccess: ({ user, token }) => {
      setSession(user, token);
      message.success(t("auth.loginSuccess"));
      navigate(user.role === "admin" ? "/dashboard" : "/my-tools", {
        replace: true,
      });
    },
    onError: (error: Error) => message.error(error.message),
  });

  return (
    <LoginFormPage
      title={t("app.title")}
      subTitle={t("auth.subtitleLogin")}
      backgroundImageUrl="https://gw.alipayobjects.com/zos/rmsportal/FfdJeJRQWjEeGTpqgBKj.png"
      submitter={{
        searchConfig: { submitText: t("auth.signIn") },
        submitButtonProps: { loading: mutation.isPending },
      }}
      onFinish={async (values) => {
        mutation.mutate(values as { email: string; password: string });
      }}
      activityConfig={{
        style: { boxShadow: "none", width: "100%" },
        title: t("auth.demoAccounts"),
        subTitle: (
          <Space wrap>
            <Tag color="processing">admin@example.com / Admin@123</Tag>
            <Tag color="purple">user@example.com / User@123</Tag>
          </Space>
        ),
        action: (
          <div className="grid gap-4 md:grid-cols-3">
            <ProCard>
              <Statistic title={t("auth.statsRolesTitle")} value="Admin / User" />
            </ProCard>
            <ProCard>
              <Statistic
                title={t("auth.statsDurationTitle")}
                value={t("auth.statsDurationValue")}
              />
            </ProCard>
            <ProCard>
              <Statistic title={t("auth.statsEngineTitle")} value="Playwright" />
            </ProCard>
          </div>
        ),
      }}
      actions={
        <Button type="link" onClick={() => navigate("/register")}>
          {t("auth.needAccount")}
        </Button>
      }
    >
      <ProFormText
        name="email"
        fieldProps={{ size: "large" }}
        placeholder="admin@example.com"
        rules={[{ required: true, type: "email" }]}
      />
      <ProFormText.Password
        name="password"
        fieldProps={{ size: "large" }}
        placeholder="Admin@123"
        rules={[{ required: true }]}
      />
    </LoginFormPage>
  );
}

