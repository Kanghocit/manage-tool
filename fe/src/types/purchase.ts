export type PackageCode = string;

export type PurchaseOrderDto = {
  id: string;
  packageCode: string;
  amountVnd: number;
  transferContent: string;
  status: "pending" | "paid" | "failed" | "expired";
  qrImageUrl: string | null;
  fulfilledLicenseId?: string | null;
  createdAt?: string;
};
