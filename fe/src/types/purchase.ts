export type PackageCode = "PKG_1D" | "PKG_3M" | "PKG_6M" | "PKG_12M" | "PKG_24M";

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
