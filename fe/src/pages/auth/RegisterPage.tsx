import { QuestionCircleOutlined } from "@ant-design/icons";
import { App as AntApp, Button, Form, Input, Tooltip, Typography } from "antd";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { isValidVnMobilePhone, normalizeVnPhone } from "../../lib/phone";
import { useAuthStore } from "../../store/useAuthStore";
import { AuthShell } from "./AuthShell";

function authErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === "string") return msg;
  }
  if (err instanceof Error) return err.message;
  return "Request failed.";
}

type RegisterForm = {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
};

function FieldLabelWithHelp({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      <Tooltip title={tooltip} overlayStyle={{ maxWidth: 320 }}>
        <QuestionCircleOutlined
          className="cursor-help text-sm text-slate-400"
          aria-label={tooltip}
        />
      </Tooltip>
    </span>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const setUser = useAuthStore((state) => state.setUser);
  const { t } = useTranslation();
  const [form] = Form.useForm<RegisterForm>();

  const mutation = useMutation({
    mutationFn: (values: RegisterForm) => {
      const payload: Record<string, string> = {
        fullName: values.fullName.trim(),
        phone: normalizeVnPhone(values.phone),
        password: values.password,
      };
      const email = values.email?.trim();
      if (email) payload.email = email;
      return api.post("/api/auth/register", payload).then((res) => res.data);
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
      message.success(t("auth.registerSuccess"));
      navigate(data.user.role === "admin" ? "/dashboard" : "/my-license", {
        replace: true,
      });
    },
    onError: (error: unknown) => message.error(authErrorMessage(error)),
  });

  const aside = (
    <div className="space-y-4">
      <Typography.Title level={2} className="!mb-2 !text-slate-900">
        {t("auth.register")}
      </Typography.Title>
      <Typography.Paragraph type="secondary" className="!mb-0">
        {t("auth.subtitleRegister")}
      </Typography.Paragraph>
    </div>
  );

  return (
    <AuthShell aside={aside}>
      <div className="w-full rounded-2xl border border-slate-200/80 bg-white/95 p-8 shadow-xl shadow-slate-200/60 backdrop-blur-sm">
        <Typography.Title level={3} className="!mb-1 !text-slate-900">
          {t("auth.register")}
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="!mb-8">
          {t("auth.subtitleRegister")}
        </Typography.Paragraph>

        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          size="large"
          onFinish={(values) => mutation.mutate(values)}
        >
          <Form.Item
            name="fullName"
            label={t("fields.fullName")}
            rules={[{ required: true, message: t("auth.fullNameRequired") }]}
          >
            <Input placeholder="Nguyen Van A" autoComplete="name" />
          </Form.Item>
          <Form.Item
            name="phone"
            label={
              <FieldLabelWithHelp
                label={t("auth.phoneLabel")}
                tooltip={t("auth.phoneHelpTooltip")}
              />
            }
            rules={[
              { required: true, message: t("auth.phoneRequired") },
              {
                validator: (_, value) => {
                  if (!value || isValidVnMobilePhone(String(value))) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t("auth.phoneInvalid")));
                },
              },
            ]}
          >
            <Input placeholder="0912345678" autoComplete="tel" inputMode="tel" />
          </Form.Item>
          <Form.Item
            name="email"
            label={
              <FieldLabelWithHelp
                label={t("auth.emailOptional")}
                tooltip={t("auth.emailHelpTooltip")}
              />
            }
            rules={[{ type: "email", message: t("auth.emailRequired") }]}
          >
            <Input placeholder="user@example.com" autoComplete="email" />
          </Form.Item>
          <Form.Item
            name="password"
            label={t("auth.passwordLabel")}
            rules={[
              { required: true, message: t("auth.passwordRequired") },
              { min: 6, message: t("auth.passwordPlaceholder") },
            ]}
          >
            <Input.Password placeholder={t("auth.passwordPlaceholder")} autoComplete="new-password" />
          </Form.Item>
          <Form.Item className="!mb-3">
            <Button type="primary" htmlType="submit" block loading={mutation.isPending} size="large">
              {t("auth.register")}
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center">
          <Button type="link" onClick={() => navigate("/login")}>
            {t("auth.backToLogin")}
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
