export type ZaloAccountRow = {
  id: string;
  zaloUid: string;
  displayName: string;
  avatar: string | null;
  status: "active" | "disconnected" | "error";
  lastActiveAt: string | null;
  createdAt: string;
};

export type QrLoginSnapshot = {
  loginId: string;
  status:
    | "pending"
    | "waiting_scan"
    | "scanned"
    | "success"
    | "expired"
    | "declined"
    | "error";
  qrImage?: string;
  scannedDisplayName?: string;
  scannedAvatar?: string;
  accountId?: string;
  errorMessage?: string;
  updatedAt: number;
};

export type ZaloGroupRow = {
  groupId: string;
  name: string;
  memberCount: number;
  avatar: string | null;
};

export type ZaloScanSummary = {
  id: string;
  groupId: string;
  groupName: string | null;
  memberCount: number;
  status: "running" | "completed" | "failed";
  progress: number;
  createdAt: string;
  account: { id: string; displayName: string };
};

export type ZaloGroupMemberRow = {
  id: string;
  uid: string;
  displayName: string | null;
  zaloName: string | null;
  avatar: string | null;
  memberType: number | null;
};

export type ZaloWsEvent =
  | { type: "zalo:connected" }
  | ({ type: "zalo:qr" } & QrLoginSnapshot)
  | {
      type: "zalo:loggedIn";
      accountId: string;
      displayName: string;
      avatar?: string;
    }
  | {
      type: "zalo:scanProgress";
      scanId: string;
      progress: number;
      memberCount?: number;
      status?: string;
    }
  | { type: "error"; code: string; message: string };
