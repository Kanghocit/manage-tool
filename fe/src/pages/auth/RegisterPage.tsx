import { App as AntApp, Button } from "antd";
import {
  LoginFormPage,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { mockApi } from "../../lib/mock-api";
import { useAuthStore, type Role } from "../../store/useAuthStore";

export function RegisterPage() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const setSession = useAuthStore((state) => state.setSession);
  const { t } = useTranslation();

  const mutation = useMutation({
    mutationFn: (values: {
      fullName: string;
      email: string;
      password: string;
      role: Role;
    }) => mockApi.register(values),
    onSuccess: ({ user, token }) => {
      setSession(user, token);
      message.success(t("auth.registerSuccess"));
      navigate(user.role === "admin" ? "/dashboard" : "/my-tools", {
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
            role: Role;
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
      <ProFormSelect
        name="role"
        initialValue="user"
        options={[
          { value: "user", label: t("roles.user") },
          { value: "admin", label: t("roles.admin") },
        ]}
        rules={[{ required: true }]}
      />
    </LoginFormPage>
  );
}

