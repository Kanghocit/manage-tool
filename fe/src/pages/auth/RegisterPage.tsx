import { App as AntApp, Button } from "antd";
import { LoginFormPage, ProFormText } from "@ant-design/pro-components";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/useAuthStore";

export function RegisterPage() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const setSession = useAuthStore((state) => state.setSession);
  const { t } = useTranslation();

  const mutation = useMutation({
    mutationFn: (values: { fullName: string; email: string; password: string }) =>
      api.post("/api/auth/register", values).then((res) => res.data),
    onSuccess: (data: {
      user: { id: string; email: string; fullName: string; role: "admin" | "user"; status: "active" | "blocked" };
      accessToken: string;
      refreshToken: string;
    }) => {
      setSession(data.user, data.accessToken, data.refreshToken);
      message.success(t("auth.registerSuccess"));
      navigate(data.user.role === "admin" ? "/dashboard" : "/my-license", {
        replace: true,
      });
    },
    onError: (error: Error) => message.error(error.message),
  });

  return (
    <LoginFormPage
      title={t("auth.register")}
      subTitle={t("auth.subtitleRegister")}
      backgroundImageUrl="https://gw.alipayobjects.com/zos/rmsportal/FfdJeJRQWjEeGTpqgBKj.png"
      submitter={{
        searchConfig: { submitText: t("auth.register") },
        submitButtonProps: { loading: mutation.isPending },
      }}
      onFinish={async (values) => {
        mutation.mutate(
          values as {
            fullName: string;
            email: string;
            password: string;
          },
        );
      }}
      actions={
        <Button type="link" onClick={() => navigate("/login")}>
          {t("auth.backToLogin")}
        </Button>
      }
    >
      <ProFormText
        name="fullName"
        placeholder="Nguyen Van A"
        rules={[{ required: true }]}
      />
      <ProFormText
        name="email"
        placeholder="user@example.com"
        rules={[{ required: true, type: "email" }]}
      />
      <ProFormText.Password
        name="password"
        placeholder={t("auth.passwordPlaceholder")}
        rules={[{ required: true, min: 6 }]}
      />
      {/* role luôn là user trong phiên bản này */}
    </LoginFormPage>
  );
}

