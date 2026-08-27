import { App as AntApp, Button, Modal, Space, Upload } from "antd";
import { DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";
import axios from "axios";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../lib/api";

type ImportResult = {
  createdCount: number;
  skippedCount: number;
  created: unknown[];
  skipped: { row: number; email?: string; reason: string }[];
};

type Props = {
  exportUrl: string;
  importUrl: string;
  templateUrl: string;
  onImported?: () => void;
};

async function downloadFile(url: string, fallbackName: string) {
  const res = await api.get(url, { responseType: "blob" });
  const disposition = res.headers["content-disposition"] as string | undefined;
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackName;
  const blobUrl = URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(blobUrl);
}

export function AdminExcelTransferButtons({
  exportUrl,
  importUrl,
  templateUrl,
  onImported,
}: Props) {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleExport = async () => {
    try {
      setExporting(true);
      await downloadFile(exportUrl, "export.xlsx");
    } catch {
      message.error(t("adminDataTransfer.exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  const handleTemplate = async () => {
    try {
      await downloadFile(templateUrl, "template.xlsx");
    } catch {
      message.error(t("adminDataTransfer.exportFailed"));
    }
  };

  const uploadProps: UploadProps = {
    accept: ".xlsx,.xls",
    maxCount: 1,
    showUploadList: true,
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        setImporting(true);
        setResult(null);
        const formData = new FormData();
        formData.append("file", file as File);
        const { data } = await api.post<ImportResult & { success: boolean }>(
          importUrl,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
        setResult(data);
        message.success(
          t("adminDataTransfer.importDone", {
            created: data.createdCount,
            skipped: data.skippedCount,
          }),
        );
        onImported?.();
        onSuccess?.(data);
      } catch (err) {
        const msg = axios.isAxiosError(err)
          ? (err.response?.data as { message?: string })?.message
          : undefined;
        message.error(msg ?? t("adminDataTransfer.importFailed"));
        onError?.(err as Error);
      } finally {
        setImporting(false);
      }
    },
  };

  return (
    <>
      <Space wrap>
        <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
          {t("adminDataTransfer.exportExcel")}
        </Button>
        <Button onClick={() => { setResult(null); setImportOpen(true); }}>
          <UploadOutlined /> {t("adminDataTransfer.importExcel")}
        </Button>
      </Space>

      <Modal
        title={t("adminDataTransfer.importExcel")}
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        footer={null}
        destroyOnClose
      >
        <p className="mb-3 text-sm text-slate-600">{t("adminDataTransfer.importHint")}</p>
        <Button type="link" className="mb-3 px-0" onClick={handleTemplate}>
          {t("adminDataTransfer.downloadTemplate")}
        </Button>
        <Upload.Dragger {...uploadProps} disabled={importing}>
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p>{t("adminDataTransfer.dropFile")}</p>
        </Upload.Dragger>
        {result ? (
          <div className="mt-4 text-sm">
            <p>
              {t("adminDataTransfer.importSummary", {
                created: result.createdCount,
                skipped: result.skippedCount,
              })}
            </p>
            {result.skipped.length > 0 ? (
              <ul className="mt-2 max-h-40 overflow-auto text-red-600">
                {result.skipped.slice(0, 20).map((s) => (
                  <li key={`${s.row}-${s.reason}`}>
                    {t("adminDataTransfer.skippedRow", {
                      row: s.row,
                      reason: s.reason,
                    })}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
