import { App as AntApp, Button, Form, Input, Typography } from "antd";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { isValidVnMobilePhone, normalizeVnPhone } from "../../lib/phone";
import { useAuthStore } from "../../store/useAuthStore";
import { sanitizeAppRedirect } from "../../lib/safeRedirect";
import { AuthShell } from "./AuthShell";

function authErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === "string") return msg;
    const code = err.response?.data?.code;
    if (code === "DEVICE_MISMATCH")
      return err.response?.data?.message ?? "Device mismatch.";
  }
  if (err instanceof Error) return err.message;
  return "Request failed.";
}

type LoginForm = {
  identifier: string;
  password: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { message } = AntApp.useApp();
  const setUser = useAuthStore((state) => state.setUser);
  const { t } = useTranslation();
  const [form] = Form.useForm<LoginForm>();

  const redirectTo = sanitizeAppRedirect(
    searchParams.get("redirect") ??
      (location.state as { from?: { pathname?: string } } | null)?.from?.pathname,
    "/my-license",
  );

  const mutation = useMutation({
    mutationFn: (values: LoginForm) => {
      const identifier = values.identifier.trim();
      const body =
        identifier.includes("@")
          ? { email: identifier, password: values.password }
          : { phone: normalizeVnPhone(identifier), password: values.password };
      return api.post("/api/auth/login", body).then((res) => res.data);
    },
    onSuccess: (data: {
      user: {
        id: string;
        email: string | null;
        phone: string | null;
        fullName: string;
        role: "admin" | "user";
        status: "active" | "blocked";
      };
    }) => {
      setUser(data.user);
      message.success(t("auth.loginSuccess"));
      navigate(
        data.user.role === "admin" && redirectTo === "/my-license"
          ? "/dashboard"
          : redirectTo,
        { replace: true },
      );
    },
    onError: (error: unknown) => {
      const code = axios.isAxiosError(error)
        ? error.response?.data?.code
        : undefined;
      if (code === "DEVICE_MISMATCH") {
        message.error(t("auth.deviceMismatch"));
      } else {
        message.error(authErrorMessage(error));
      }
    },
  });

  const aside = (
    <div className="space-y-6">
      <div>
        <Typography.Title level={2} className="!mb-2 !text-slate-900">
          {t("auth.sayHi")}
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="!mb-4">
          {t("auth.subtitleLogin")}
        </Typography.Paragraph>
      </div>
    </div>
  );

  return (
    <AuthShell aside={aside}>
      <div className="w-full rounded-2xl border border-slate-200/80 bg-white/95 p-8 shadow-xl shadow-slate-200/60 backdrop-blur-sm">
        <Typography.Title level={3} className="mb-1 text-slate-900">
          {t("app.title")}
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="mb-4">
          {t("auth.subtitleLogin")}
        </Typography.Paragraph>

        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          size="large"
          onFinish={(values) => mutation.mutate(values)}
        >
          <Form.Item
            name="identifier"
            label={t("auth.loginIdentifierLabel")}
            rules={[
              { required: true, message: t("auth.loginIdentifierRequired") },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  const s = String(value).trim();
                  if (s.includes("@")) return Promise.resolve();
                  if (isValidVnMobilePhone(s)) return Promise.resolve();
                  return Promise.reject(new Error(t("auth.phoneInvalid")));
                },
              },
            ]}
          >
            <Input
              placeholder="0912345678 hoặc admin@example.com"
              autoComplete="username"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label={t("auth.passwordLabel")}
            rules={[{ required: true, message: t("auth.passwordRequired") }]}
          >
            <Input.Password
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Form.Item>
          <Form.Item className="mb-3">
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={mutation.isPending}
              size="large"
            >
              {t("auth.signIn")}
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center">
          <Button type="link" onClick={() => navigate("/register")}>
            {t("auth.needAccount")}
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
