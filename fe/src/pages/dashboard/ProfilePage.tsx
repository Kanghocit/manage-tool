import axios from "axios";
import { useState } from "react";
import {
  App as AntApp,
  Button,
  Form,
  Input,
  Modal,
  Statistic,
  Tag,
} from "antd";
import {
  PageContainer,
  ProCard,
  ProDescriptions,
} from "@ant-design/pro-components";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/useAuthStore";

function authErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === "string") return msg;
  }
  if (err instanceof Error) return err.message;
  return "Request failed.";
}

type ChangePasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<ChangePasswordForm>();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const closeChangePasswordModal = () => {
    setChangePasswordOpen(false);
    form.resetFields();
  };

  const changePasswordMutation = useMutation({
    mutationFn: (values: Pick<ChangePasswordForm, "currentPassword" | "newPassword">) =>
      api
        .post("/api/auth/change-password", values)
        .then((res) => res.data),
    onSuccess: () => {
      message.success(t("profile.passwordChanged"));
      closeChangePasswordModal();
    },
    onError: (error) => {
      message.error(authErrorMessage(error));
    },
  });

  return (
    <PageContainer title={t("pages.profileTitle")}>
      <div className="grid grid-equal-rows gap-4 lg:grid-cols-2">
        <ProCard bordered className="h-full">
          <Statistic
            title={t("fields.fullName")}
            value={user?.fullName ?? "-"}
          />
        </ProCard>
        <ProCard bordered className="h-full">
          <Statistic
            title={t("fields.role")}
            value={user?.role === "admin" ? t("roles.admin") : t("roles.user")}
          />
        </ProCard>
      </div>

      <ProCard bordered title={t("pages.accountDetails")} className="mt-4!">
        <ProDescriptions
          column={1}
          dataSource={{
            email: user?.email,
            status: user?.status,
            role: user?.role,
          }}
          columns={[
            { title: "Email", dataIndex: "email" },
            {
              title: t("common.status"),
              dataIndex: "status",
              render: (_, row) => (
                <Tag color="green">
                  {row.status === "active"
                    ? t("common.active")
                    : t("common.inactive")}
                </Tag>
              ),
            },
            {
              title: t("fields.role"),
              dataIndex: "role",
              render: (_, row) =>
                row.role === "admin" ? t("roles.admin") : t("roles.user"),
            },
          ]}
        />
        <Button
          type="default"
          className="mt-4"
          onClick={() => setChangePasswordOpen(true)}
        >
          {t("profile.changePassword")}
        </Button>
      </ProCard>

      <Modal
        title={t("profile.changePassword")}
        open={changePasswordOpen}
        onCancel={closeChangePasswordModal}
        destroyOnClose
        width={480}
        footer={[
          <Button key="close" onClick={closeChangePasswordModal}>
            {t("common.close")}
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={changePasswordMutation.isPending}
            onClick={() => form.submit()}
          >
            {t("profile.submit")}
          </Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) =>
            changePasswordMutation.mutate({
              currentPassword: values.currentPassword,
              newPassword: values.newPassword,
            })
          }
        >
          <Form.Item
            name="currentPassword"
            label={t("profile.currentPassword")}
            rules={[
              { required: true, message: t("auth.passwordRequired") },
              { min: 6, message: t("auth.passwordPlaceholder") },
            ]}
          >
            <Input.Password
              autoComplete="current-password"
              placeholder={t("auth.passwordPlaceholder")}
            />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label={t("profile.newPassword")}
            rules={[
              { required: true, message: t("auth.passwordRequired") },
              { min: 6, message: t("auth.passwordPlaceholder") },
            ]}
          >
            <Input.Password
              autoComplete="new-password"
              placeholder={t("auth.passwordPlaceholder")}
            />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={t("profile.confirmPassword")}
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: t("auth.passwordRequired") },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t("profile.passwordMismatch")));
                },
              }),
            ]}
          >
            <Input.Password
              autoComplete="new-password"
              placeholder={t("auth.passwordPlaceholder")}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
