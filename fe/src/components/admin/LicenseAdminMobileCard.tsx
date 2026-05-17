import { Button, Card, Tag } from "antd";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

export type LicenseAdminRow = {
  id: string;
  licenseKey: string | null;
  licenseKeyPreview: string;
  status: string;
  durationDays: number | null;
  expiresAt: string | null;
  maxDevices: number;
  activatedBy: string | null;
  activatedAt: string | null;
};

type Props = {
  row: LicenseAdminRow;
  onDetail: () => void;
};

export function LicenseAdminMobileCard({ row, onDetail }: Props) {
  const { t } = useTranslation();

  const statusColor = (s: string) => {
    if (s === "active") return "green";
    if (s === "blocked") return "red";
    if (s === "expired") return "default";
    return "blue";
  };

  return (
    <Card size="small" className="admin-mobile-card w-full">
      <div className="mb-2 font-mono text-sm break-all">
        {row.licenseKey ?? (
          <span className="text-slate-500">
            {row.licenseKeyPreview} ({t("adminLicenses.legacyNoPlain")})
          </span>
        )}
      </div>
      <Tag color={statusColor(row.status)} className="mb-2">
        {row.status}
      </Tag>
      <div className="mb-1 text-sm text-slate-600">
        {t("adminLicenses.durationDays")}:{" "}
        {row.durationDays == null ? t("adminLicenses.lifetime") : row.durationDays}
      </div>
      <div className="mb-1 text-sm text-slate-600">
        {t("pages.expiresAt")}:{" "}
        {row.expiresAt ? dayjs(row.expiresAt).format("YYYY-MM-DD HH:mm") : "-"}
      </div>
      <div className="mb-3 text-sm text-slate-600">
        {t("pages.maxDevices")}: {row.maxDevices}
      </div>
      <Button type="primary" block onClick={onDetail} className="admin-mobile-actions">
        {t("adminLicenses.detail")}
      </Button>
    </Card>
  );
}
