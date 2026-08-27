import {
  App as AntApp,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import { PageContainer } from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";

import { api } from "../../lib/api";

type PromotionRow = {
  id: string;
  promoAmountVnd: number;
  startsAt: string;
  endsAt: string;
  label: string | null;
  isEnabled: boolean;
  createdAt: string;
};

type PackageRow = {
  id: string;
  code: string;
  durationDays: number;
  baseAmountVnd: number;
  labelKey: string;
  sortOrder: number;
  isActive: boolean;
  currentPrice: {
    amountVnd: number;
    originalAmountVnd: number;
    promotion: {
      id: string;
      promoAmountVnd: number;
      label: string | null;
      startsAt: string;
      endsAt: string;
    } | null;
  };
  promotions: PromotionRow[];
};

type PackageFormValues = {
  code: string;
  labelKey: string;
  durationDays: number;
  baseAmountVnd: number;
  sortOrder: number;
  isActive: boolean;
};

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN");
}

function apiErrorMessage(err: unknown) {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string })?.message;
  }
  return undefined;
}

async function fetchPackages() {
  const { data } = await api.get<{ success: boolean; items: PackageRow[] }>(
    "/api/admin/license-packages",
  );
  return data.items;
}

export function AdminLicensePackagesPage() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPkg, setEditPkg] = useState<PackageRow | null>(null);
  const [promoPkg, setPromoPkg] = useState<PackageRow | null>(null);
  const [editPromo, setEditPromo] = useState<PromotionRow | null>(null);
  const [packageForm] = Form.useForm<PackageFormValues>();
  const [promoForm] = Form.useForm<{
    promoAmountVnd: number;
    dateRange: [dayjs.Dayjs, dayjs.Dayjs];
    label?: string;
    isEnabled?: boolean;
  }>();

  const packagesQuery = useQuery({
    queryKey: ["admin-license-packages"],
    queryFn: fetchPackages,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-license-packages"] });
    void queryClient.invalidateQueries({ queryKey: ["public-packages"] });
  };

  const createPackageMut = useMutation({
    mutationFn: (body: PackageFormValues) => api.post("/api/admin/license-packages", body),
    onSuccess: () => {
      message.success(t("adminLicensePackages.packageCreated"));
      setCreateOpen(false);
      packageForm.resetFields();
      invalidate();
    },
    onError: (err: unknown) => message.error(apiErrorMessage(err) ?? "Request failed"),
  });

  const patchPackageMut = useMutation({
    mutationFn: ({
      code,
      ...body
    }: {
      code: string;
      labelKey?: string;
      durationDays?: number;
      baseAmountVnd?: number;
      sortOrder?: number;
      isActive?: boolean;
    }) => api.patch(`/api/admin/license-packages/${code}`, body),
    onSuccess: (_, vars) => {
      if (vars.isActive === true) {
        message.success(t("adminLicensePackages.packageActivated"));
      } else if (vars.isActive === false) {
        message.success(t("adminLicensePackages.packageDeactivated"));
      } else {
        message.success(t("adminLicensePackages.packageUpdated"));
      }
      setEditPkg(null);
      invalidate();
    },
    onError: (err: unknown) => message.error(apiErrorMessage(err) ?? "Request failed"),
  });

  const savePromoMut = useMutation({
    mutationFn: async (payload: {
      code: string;
      promoId?: string;
      promoAmountVnd: number;
      startsAt: string;
      endsAt: string;
      label?: string;
      isEnabled?: boolean;
    }) => {
      const { code, promoId, ...body } = payload;
      if (promoId) {
        return api.patch(`/api/admin/license-packages/${code}/promotions/${promoId}`, body);
      }
      return api.post(`/api/admin/license-packages/${code}/promotions`, body);
    },
    onSuccess: () => {
      message.success(t("adminLicensePackages.promotionSaved"));
      setPromoPkg(null);
      setEditPromo(null);
      promoForm.resetFields();
      invalidate();
    },
    onError: (err: unknown) => message.error(apiErrorMessage(err) ?? "Request failed"),
  });

  const deletePromoMut = useMutation({
    mutationFn: ({ code, id }: { code: string; id: string }) =>
      api.delete(`/api/admin/license-packages/${code}/promotions/${id}`),
    onSuccess: () => {
      message.success(t("adminLicensePackages.promotionDeleted"));
      invalidate();
    },
    onError: (err: unknown) => message.error(apiErrorMessage(err) ?? "Request failed"),
  });

  const openCreate = () => {
    packageForm.setFieldsValue({
      code: "",
      labelKey: "",
      durationDays: 30,
      baseAmountVnd: 100_000,
      sortOrder: 0,
      isActive: true,
    });
    setCreateOpen(true);
  };

  const openEditPackage = (row: PackageRow) => {
    setEditPkg(row);
    packageForm.setFieldsValue({
      code: row.code,
      labelKey: row.labelKey,
      durationDays: row.durationDays,
      baseAmountVnd: row.baseAmountVnd,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    });
  };

  const openAddPromo = (row: PackageRow) => {
    setPromoPkg(row);
    setEditPromo(null);
    promoForm.setFieldsValue({
      promoAmountVnd: row.baseAmountVnd,
      dateRange: [dayjs(), dayjs().add(7, "day")],
      label: "",
      isEnabled: true,
    });
  };

  const openEditPromo = (pkg: PackageRow, promo: PromotionRow) => {
    setPromoPkg(pkg);
    setEditPromo(promo);
    promoForm.setFieldsValue({
      promoAmountVnd: promo.promoAmountVnd,
      dateRange: [dayjs(promo.startsAt), dayjs(promo.endsAt)],
      label: promo.label ?? "",
      isEnabled: promo.isEnabled,
    });
  };

  const columns = [
    {
      title: t("adminLicensePackages.code"),
      dataIndex: "code",
      key: "code",
    },
    {
      title: t("adminLicensePackages.displayName"),
      dataIndex: "labelKey",
      key: "labelKey",
    },
    {
      title: t("adminLicensePackages.duration"),
      dataIndex: "durationDays",
      key: "durationDays",
      render: (days: number) => `${days} ${t("adminLicenses.days")}`,
    },
    {
      title: t("adminLicensePackages.sortOrder"),
      dataIndex: "sortOrder",
      key: "sortOrder",
    },
    {
      title: t("adminLicensePackages.basePrice"),
      dataIndex: "baseAmountVnd",
      key: "baseAmountVnd",
      render: (v: number) => `${formatVnd(v)} ₫`,
    },
    {
      title: t("adminLicensePackages.currentPrice"),
      key: "currentPrice",
      render: (_: unknown, row: PackageRow) => {
        const { currentPrice } = row;
        if (currentPrice.promotion) {
          return (
            <Space direction="vertical" size={0}>
              <span className="font-semibold text-red-600">
                {formatVnd(currentPrice.amountVnd)} ₫
              </span>
              <span className="text-xs text-slate-400 line-through">
                {formatVnd(currentPrice.originalAmountVnd)} ₫
              </span>
              <Tag color="red">{t("adminLicensePackages.onPromotion")}</Tag>
            </Space>
          );
        }
        return `${formatVnd(currentPrice.amountVnd)} ₫`;
      },
    },
    {
      title: t("common.status"),
      dataIndex: "isActive",
      key: "isActive",
      render: (v: boolean) =>
        v ? <Tag color="green">{t("common.active")}</Tag> : <Tag>{t("common.inactive")}</Tag>,
    },
    {
      title: t("common.actions"),
      key: "actions",
      render: (_: unknown, row: PackageRow) => (
        <Space wrap>
          <Button type="link" size="small" onClick={() => openEditPackage(row)}>
            {t("adminLicensePackages.editPackage")}
          </Button>
          <Button type="link" size="small" onClick={() => openAddPromo(row)}>
            {t("adminLicensePackages.addPromotion")}
          </Button>
          {row.isActive ? (
            <Popconfirm
              title={t("adminLicensePackages.confirmDeactivate")}
              onConfirm={() =>
                patchPackageMut.mutate({ code: row.code, isActive: false })
              }
            >
              <Button type="link" size="small" danger>
                {t("adminLicensePackages.deactivatePackage")}
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title={t("adminLicensePackages.confirmActivate")}
              onConfirm={() =>
                patchPackageMut.mutate({ code: row.code, isActive: true })
              }
            >
              <Button type="link" size="small">
                {t("adminLicensePackages.activatePackage")}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const renderPackageForm = (mode: "create" | "edit") => (
    <Form
      form={packageForm}
      layout="vertical"
      onFinish={(values) => {
        if (mode === "create") {
          createPackageMut.mutate(values);
          return;
        }
        if (!editPkg) return;
        patchPackageMut.mutate({
          code: editPkg.code,
          labelKey: values.labelKey,
          durationDays: values.durationDays,
          baseAmountVnd: values.baseAmountVnd,
          sortOrder: values.sortOrder,
          isActive: values.isActive,
        });
      }}
    >
      <Form.Item
        name="code"
        label={t("adminLicensePackages.code")}
        rules={
          mode === "create"
            ? [
                { required: true, message: t("adminLicensePackages.codeRequired") },
                {
                  pattern: /^[A-Z0-9_]{2,32}$/,
                  message: t("adminLicensePackages.codeInvalid"),
                },
              ]
            : undefined
        }
      >
        <Input disabled={mode === "edit"} placeholder="PKG_7D" />
      </Form.Item>
      <Form.Item
        name="labelKey"
        label={t("adminLicensePackages.displayName")}
        rules={[{ required: true, message: t("adminLicensePackages.displayNameRequired") }]}
      >
        <Input maxLength={100} />
      </Form.Item>
      <Form.Item
        name="durationDays"
        label={t("adminLicensePackages.duration")}
        rules={[{ required: true, type: "number", min: 1 }]}
      >
        <InputNumber className="w-full" min={1} />
      </Form.Item>
      <Form.Item
        name="baseAmountVnd"
        label={t("adminLicensePackages.basePrice")}
        rules={[{ required: true, type: "number", min: 1 }]}
      >
        <InputNumber className="w-full" min={1} step={1000} />
      </Form.Item>
      <Form.Item
        name="sortOrder"
        label={t("adminLicensePackages.sortOrder")}
        rules={[{ required: true, type: "number" }]}
      >
        <InputNumber className="w-full" />
      </Form.Item>
      <Form.Item name="isActive" label={t("common.status")} valuePropName="checked">
        <Switch />
      </Form.Item>
    </Form>
  );

  return (
    <PageContainer
      title={t("menu.licensePackages")}
      extra={
        <Button type="primary" onClick={openCreate}>
          {t("adminLicensePackages.createPackage")}
        </Button>
      }
    >
      <Typography.Paragraph type="secondary">
        {t("adminLicensePackages.subtitle")}
      </Typography.Paragraph>

      <Table<PackageRow>
        rowKey="code"
        loading={packagesQuery.isLoading}
        dataSource={packagesQuery.data ?? []}
        columns={columns}
        pagination={false}
        expandable={{
          expandedRowRender: (row) => (
            <Table<PromotionRow>
              rowKey="id"
              size="small"
              dataSource={row.promotions}
              pagination={false}
              locale={{ emptyText: t("adminLicensePackages.noPromotions") }}
              columns={[
                {
                  title: t("adminLicensePackages.promoPrice"),
                  dataIndex: "promoAmountVnd",
                  render: (v: number) => `${formatVnd(v)} ₫`,
                },
                {
                  title: t("adminLicensePackages.promoPeriod"),
                  key: "period",
                  render: (_: unknown, p: PromotionRow) =>
                    `${dayjs(p.startsAt).format("YYYY-MM-DD HH:mm")} → ${dayjs(p.endsAt).format("YYYY-MM-DD HH:mm")}`,
                },
                {
                  title: t("adminLicensePackages.promoLabel"),
                  dataIndex: "label",
                  render: (v: string | null) => v ?? "—",
                },
                {
                  title: t("common.status"),
                  dataIndex: "isEnabled",
                  render: (v: boolean) =>
                    v ? <Tag color="green">{t("common.active")}</Tag> : <Tag>{t("common.inactive")}</Tag>,
                },
                {
                  title: t("common.actions"),
                  key: "actions",
                  render: (_: unknown, p: PromotionRow) => (
                    <Space>
                      <Button type="link" onClick={() => openEditPromo(row, p)}>
                        {t("common.edit")}
                      </Button>
                      <Popconfirm
                        title={t("adminLicensePackages.confirmDeletePromotion")}
                        onConfirm={() => deletePromoMut.mutate({ code: row.code, id: p.id })}
                      >
                        <Button type="link" danger>
                          {t("common.delete")}
                        </Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          ),
        }}
      />

      <Modal
        title={t("adminLicensePackages.createPackage")}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => packageForm.submit()}
        confirmLoading={createPackageMut.isPending}
        destroyOnClose
      >
        {renderPackageForm("create")}
      </Modal>

      <Modal
        title={t("adminLicensePackages.editPackage")}
        open={!!editPkg}
        onCancel={() => setEditPkg(null)}
        onOk={() => packageForm.submit()}
        confirmLoading={patchPackageMut.isPending}
        destroyOnClose
      >
        {renderPackageForm("edit")}
      </Modal>

      <Modal
        title={
          editPromo
            ? t("adminLicensePackages.editPromotion")
            : t("adminLicensePackages.addPromotion")
        }
        open={!!promoPkg}
        onCancel={() => {
          setPromoPkg(null);
          setEditPromo(null);
        }}
        onOk={() => promoForm.submit()}
        confirmLoading={savePromoMut.isPending}
      >
        <Form
          form={promoForm}
          layout="vertical"
          onFinish={(values) => {
            if (!promoPkg) return;
            savePromoMut.mutate({
              code: promoPkg.code,
              promoId: editPromo?.id,
              promoAmountVnd: values.promoAmountVnd,
              startsAt: values.dateRange[0].toISOString(),
              endsAt: values.dateRange[1].toISOString(),
              label: values.label?.trim() || undefined,
              isEnabled: values.isEnabled,
            });
          }}
        >
          <Form.Item
            name="promoAmountVnd"
            label={t("adminLicensePackages.promoPrice")}
            rules={[{ required: true, type: "number", min: 1 }]}
          >
            <InputNumber className="w-full" min={1} step={1000} />
          </Form.Item>
          <Form.Item
            name="dateRange"
            label={t("adminLicensePackages.promoPeriod")}
            rules={[{ required: true, message: t("adminLicensePackages.promoPeriodRequired") }]}
          >
            <DatePicker.RangePicker showTime className="w-full" />
          </Form.Item>
          <Form.Item name="label" label={t("adminLicensePackages.promoLabel")}>
            <Input maxLength={200} />
          </Form.Item>
          {editPromo ? (
            <Form.Item name="isEnabled" label={t("common.status")} valuePropName="checked">
              <Switch />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </PageContainer>
  );
}
