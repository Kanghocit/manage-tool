import { Button, Card, Popconfirm, Space, Tag, Tooltip } from "antd";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

export type UserAdminRow = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "user";
  status: "active" | "blocked";
  createdAt: string;
  registeredDeviceId: string | null;
};

type Props = {
  row: UserAdminRow;
  isSelf: boolean;
  blockLoading: boolean;
  unblockLoading: boolean;
  resetDeviceLoading: boolean;
  onBlock: () => void;
  onUnblock: () => void;
  onResetDevice: () => void;
};

export function UserAdminMobileCard({
  row,
  isSelf,
  blockLoading,
  unblockLoading,
  resetDeviceLoading,
  onBlock,
  onUnblock,
  onResetDevice,
}: Props) {
  const { t } = useTranslation();
  const statusColor = row.status === "active" ? "green" : "red";

  return (
    <Card size="small" className="admin-mobile-card">
      <div className="mb-2 font-medium text-slate-900">{row.fullName}</div>
      <div className="mb-2 text-sm text-slate-600 break-all">{row.email}</div>
      <Space wrap className="mb-2">
        <Tag>{t(`roles.${row.role}`)}</Tag>
        <Tag color={statusColor}>{row.status}</Tag>
        {row.registeredDeviceId ? (
          <Tooltip title={row.registeredDeviceId}>
            <Tag color="blue">{t("adminUsers.deviceBound")}</Tag>
          </Tooltip>
        ) : (
          <Tag>{t("adminUsers.deviceNone")}</Tag>
        )}
      </Space>
      <div className="mb-3 text-xs text-slate-500">
        {t("adminUsers.createdAt")}: {dayjs(row.createdAt).format("YYYY-MM-DD HH:mm")}
      </div>
      <Space direction="vertical" className="admin-mobile-actions w-full" size="small">
        {row.status === "blocked" ? (
          <Popconfirm title={t("adminUsers.confirmUnblock")} onConfirm={onUnblock}>
            <Button block loading={unblockLoading}>
              {t("adminUsers.unblock")}
            </Button>
          </Popconfirm>
        ) : (
          <Popconfirm
            title={isSelf ? t("adminUsers.cannotBlockSelf") : t("adminUsers.confirmBlock")}
            onConfirm={onBlock}
            disabled={isSelf}
          >
            <Button block danger disabled={isSelf} loading={blockLoading}>
              {t("adminUsers.block")}
            </Button>
          </Popconfirm>
        )}
        {row.registeredDeviceId ? (
          <Popconfirm title={t("adminUsers.confirmResetDevice")} onConfirm={onResetDevice}>
            <Button block loading={resetDeviceLoading}>
              {t("adminUsers.resetDevice")}
            </Button>
          </Popconfirm>
        ) : null}
      </Space>
    </Card>
  );
}
