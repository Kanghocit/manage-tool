import { App as AntApp, Checkbox, Input, Modal, Select } from "antd";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../lib/api";

type CreateUserRes = {
  success: boolean;
  user: {
    id: string;
    email: string;
    fullName: string;
    registrationSource: string;
  };
  license: {
    licenseKey: string;
    durationDays: number | null;
    maxDevices: number;
  } | null;
};

type FormValues = {
  fullName: string;
  email: string;
  password: string;
  createLicense: boolean;
  durationPreset: number | "lifetime";
  maxDevices: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function CreateUserModal({ open, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [createLicense, setCreateLicense] = useState(false);
  const [durationPreset, setDurationPreset] = useState<number | "lifetime">(30);
  const [maxDevices, setMaxDevices] = useState(1);

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setCreateLicense(false);
    setDurationPreset(30);
    setMaxDevices(1);
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const durationDays =
        values.durationPreset === "lifetime" ? null : values.durationPreset;
      return api
        .post<CreateUserRes>("/api/admin/users", {
          fullName: values.fullName,
          email: values.email,
          password: values.password,
          ...(values.createLicense
            ? {
                license: {
                  enabled: true as const,
                  durationDays,
                  maxDevices: values.maxDevices,
                },
              }
            : {}),
        })
        .then((r) => r.data);
    },
    onSuccess: (data) => {
      const lines = [
        `${t("adminUsers.email")}: ${data.user.email}`,
        `${t("adminUsers.password")}: ${password}`,
      ];
      if (data.license) {
        lines.push(`${t("adminUsers.licenseKey")}: ${data.license.licenseKey}`);
      }
      const text = lines.join("\n");

      Modal.success({
        title: t("adminUsers.createSuccessTitle"),
        width: "min(560px, calc(100vw - 32px))",
        content: (
          <div className="space-y-3">
            <p className="text-slate-600">{t("adminUsers.createSuccessHint")}</p>
            <Input.TextArea rows={4} value={text} readOnly />
          </div>
        ),
        okText: t("adminUsers.copyAll"),
        onOk: () => {
          void navigator.clipboard.writeText(text);
          message.success(t("adminUsers.copied"));
        },
      });

      resetForm();
      onClose();
      onSuccess();
    },
    onError: (err: Error) => {
      const apiMessage = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      message.error(apiMessage ?? err.message);
    },
  });

  const handleSubmit = () => {
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      message.error(t("adminUsers.createValidation"));
      return;
    }
    mutation.mutate({
      fullName: fullName.trim(),
      email: email.trim(),
      password,
      createLicense,
      durationPreset,
      maxDevices,
    });
  };

  return (
    <Modal
      title={t("adminUsers.createUser")}
      open={open}
      onCancel={() => {
        resetForm();
        onClose();
      }}
      onOk={handleSubmit}
      confirmLoading={mutation.isPending}
      okText={t("adminUsers.createSubmit")}
      destroyOnClose
    >
      <div className="space-y-3 pt-2">
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            {t("adminUsers.fullName")}
          </label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("adminUsers.fullName")}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            {t("adminUsers.email")}
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("adminUsers.email")}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            {t("adminUsers.password")}
          </label>
          <Input.Password
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("adminUsers.passwordHint")}
          />
        </div>
        <Checkbox
          checked={createLicense}
          onChange={(e) => setCreateLicense(e.target.checked)}
        >
          {t("adminUsers.createWithLicense")}
        </Checkbox>
        {createLicense ? (
          <>
            <div>
              <label className="mb-1 block text-sm text-slate-600">
                {t("adminLicenses.durationPreset")}
              </label>
              <Select
                className="w-full"
                value={durationPreset}
                onChange={setDurationPreset}
                options={[
                  { value: 1, label: `1 ${t("adminLicenses.days")}` },
                  { value: 7, label: `7 ${t("adminLicenses.days")}` },
                  { value: 30, label: `30 ${t("adminLicenses.days")}` },
                  { value: 90, label: `90 ${t("adminLicenses.days")}` },
                  { value: 180, label: `180 ${t("adminLicenses.days")}` },
                  { value: 365, label: `365 ${t("adminLicenses.days")}` },
                  { value: "lifetime", label: t("adminLicenses.lifetime") },
                ]}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">
                {t("pages.maxDevices")}
              </label>
              <Input
                type="number"
                min={1}
                max={50}
                value={maxDevices}
                onChange={(e) => setMaxDevices(Number(e.target.value) || 1)}
              />
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
