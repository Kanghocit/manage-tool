import { App as AntApp, Alert, Button, Input, Modal, Space } from "antd";
import axios from "axios";
import {
  PageContainer,
  ProCard,
  ProForm,
  ProFormDigit,
  ProFormDependency,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";

import { api } from "../../lib/api";

type CreateRes = {
  success: boolean;
  licenses: {
    licenseKey: string;
    durationDays: number | null;
    maxDevices: number;
  }[];
};

export function AdminLicenseCreatePage() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const [plainText, setPlainText] = useState("");

  const mutation = useMutation({
    mutationFn: (values: {
      durationPreset: number | "lifetime";
      maxDevices: number;
      quantity: number;
      licenseKey?: string;
    }) => {
      const durationDays =
        values.durationPreset === "lifetime" ? null : values.durationPreset;
      const customKey = values.licenseKey?.trim();
      return api
        .post<CreateRes>("/api/admin/licenses", {
          durationDays,
          maxDevices: values.maxDevices,
          quantity: customKey ? 1 : values.quantity,
          ...(customKey ? { licenseKey: customKey } : {}),
        })
        .then((r) => r.data);
    },
    onSuccess: (data) => {
      const text = data.licenses.map((l) => l.licenseKey).join("\n");
      setPlainText(text);
      Modal.success({
        title: t("adminLicenses.keysCreatedTitle"),
        width: "min(560px, calc(100vw - 32px))",
        content: (
          <div className="space-y-3">
            <p className="text-slate-600">
              {t("adminLicenses.keysCreatedHint")}
            </p>
            <Input.TextArea
              rows={Math.min(12, data.licenses.length + 2)}
              value={text}
              readOnly
            />
            <Button
              type="primary"
              onClick={() => {
                void navigator.clipboard.writeText(text);
                message.success(t("adminLicenses.copied"));
              }}
            >
              {t("adminLicenses.copyAll")}
            </Button>
          </div>
        ),
      });
      message.success(t("adminLicenses.createSuccess"));
    },
    onError: (err: Error) => {
      const apiMessage = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      message.error(apiMessage ?? err.message);
    },
  });

  return (
    <PageContainer
      title={t("adminLicenses.create")}
      onBack={() => navigate("/admin/licenses")}
    >
      <ProCard bordered className="mx-auto w-full max-w-xl">
        <Alert
          type="info"
          showIcon
          className="mb-4"
          message={t("adminLicenses.durationStartsAtActivation")}
        />
        <ProForm
          layout="vertical"
          submitter={{
            searchConfig: { submitText: t("adminLicenses.submitCreate") },
            submitButtonProps: { loading: mutation.isPending },
          }}
          initialValues={{ durationPreset: 30, maxDevices: 1, quantity: 1 }}
          onFinish={async (values) => {
            mutation.mutate(
              values as {
                durationPreset: number | "lifetime";
                maxDevices: number;
                quantity: number;
                licenseKey?: string;
              },
            );
          }}
        >
          <ProFormText
            name="licenseKey"
            label={t("adminLicenses.customKeyLabel")}
            placeholder="MYKEY-2026-VIP"
            tooltip={t("adminLicenses.customKeyHint")}
            extra={t("adminLicenses.customKeyHint")}
            rules={[{ min: 8, message: t("adminLicenses.customKeyHint") }]}
          />
          <ProFormSelect
            name="durationPreset"
            label={t("adminLicenses.durationPreset")}
            options={[
              { value: 1, label: `1 ${t("adminLicenses.days")}` },
              { value: 7, label: `7 ${t("adminLicenses.days")}` },
              { value: 30, label: `30 ${t("adminLicenses.days")}` },
              { value: 90, label: `90 ${t("adminLicenses.days")}` },
              { value: 180, label: `180 ${t("adminLicenses.days")}` },
              { value: 365, label: `365 ${t("adminLicenses.days")}` },
              { value: "lifetime", label: t("adminLicenses.lifetime") },
            ]}
            rules={[{ required: true }]}
          />
          <ProFormDigit
            name="maxDevices"
            label={t("pages.maxDevices")}
            min={1}
            max={50}
            rules={[{ required: true }]}
          />
          <ProFormDependency name={["licenseKey"]}>
            {({ licenseKey }) => {
              const hasCustomKey = !!licenseKey?.trim();
              return (
                <ProFormDigit
                  name="quantity"
                  label={t("adminLicenses.quantity")}
                  min={1}
                  max={100}
                  disabled={hasCustomKey}
                  fieldProps={{ value: hasCustomKey ? 1 : undefined }}
                  extra={
                    hasCustomKey
                      ? t("adminLicenses.customKeyForcesSingle")
                      : undefined
                  }
                  rules={[{ required: true }]}
                />
              );
            }}
          </ProFormDependency>
        </ProForm>
        {plainText ? (
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <Space>
              <Button onClick={() => navigate("/admin/licenses")}>
                {t("adminLicenses.backToList")}
              </Button>
            </Space>
          </div>
        ) : null}
      </ProCard>
    </PageContainer>
  );
}
