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
  registrationSource: "self" | "admin";
  welcomeEmailSentAt: string | null;
  hasWelcomeTrialLicense: boolean;
};

type Props = {
  row: UserAdminRow;
  isSelf: boolean;
  blockLoading: boolean;
  unblockLoading: boolean;
  resetDeviceLoading: boolean;
  sendEmailLoading: boolean;
  onBlock: () => void;
  onUnblock: () => void;
  onResetDevice: () => void;
  onSendEmail: () => void;
};

function canSendWelcomeEmail(row: UserAdminRow) {
  return row.registrationSource === "self" && !row.welcomeEmailSentAt;
}

function getSendEmailDisabledReason(
  row: UserAdminRow,
  t: (key: string) => string,
): string | undefined {
  if (canSendWelcomeEmail(row)) return undefined;
  if (row.registrationSource !== "self") return t("adminUsers.sendEmailDisabledAdmin");
  if (row.welcomeEmailSentAt) return t("adminUsers.sendEmailDisabledSent");
  return undefined;
}

export function UserAdminMobileCard({
  row,
  isSelf,
  blockLoading,
  unblockLoading,
  resetDeviceLoading,
  sendEmailLoading,
  onBlock,
  onUnblock,
  onResetDevice,
  onSendEmail,
}: Props) {
  const { t } = useTranslation();
  const statusColor = row.status === "active" ? "green" : "red";
  const sendEmailEnabled = canSendWelcomeEmail(row);
  const sendEmailDisabledReason = getSendEmailDisabledReason(row, t);
  const resetDeviceEnabled = !!row.registeredDeviceId;

  return (
    <Card size="small" className="admin-mobile-card">
      <div className="mb-2 font-medium text-slate-900">{row.fullName}</div>
      <div className="mb-2 text-sm text-slate-600 break-all">{row.email}</div>
      <Space wrap className="mb-2">
        <Tag>{t(`roles.${row.role}`)}</Tag>
        <Tag color={statusColor}>{row.status}</Tag>
        <Tag>
          {row.registrationSource === "admin"
            ? t("adminUsers.sourceAdmin")
            : t("adminUsers.sourceSelf")}
        </Tag>
        {row.registrationSource === "self" ? (
          row.welcomeEmailSentAt ? (
            <Tag color="green">{t("adminUsers.emailSentStatus")}</Tag>
          ) : (
            <Tag color="orange">{t("adminUsers.emailPending")}</Tag>
          )
        ) : null}
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
        {sendEmailEnabled ? (
          <Popconfirm title={t("adminUsers.confirmSendEmail")} onConfirm={onSendEmail}>
            <Button block type="primary" loading={sendEmailLoading}>
              {t("adminUsers.sendEmail")}
            </Button>
          </Popconfirm>
        ) : (
          <Tooltip title={sendEmailDisabledReason}>
            <span className="block w-full">
              <Button block type="primary" disabled>
                {t("adminUsers.sendEmail")}
              </Button>
            </span>
          </Tooltip>
        )}
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
        {resetDeviceEnabled ? (
          <Popconfirm title={t("adminUsers.confirmResetDevice")} onConfirm={onResetDevice}>
            <Button block loading={resetDeviceLoading}>
              {t("adminUsers.resetDevice")}
            </Button>
          </Popconfirm>
        ) : (
          <Tooltip title={t("adminUsers.resetDeviceDisabled")}>
            <span className="block w-full">
              <Button block disabled>
                {t("adminUsers.resetDevice")}
              </Button>
            </span>
          </Tooltip>
        )}
      </Space>
    </Card>
  );
}
