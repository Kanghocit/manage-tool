import { useEffect, useRef } from "react";
import { Spin, Typography } from "antd";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { api } from "../../lib/api";
import { sanitizeAppRedirect } from "../../lib/safeRedirect";
import { useAuthStore } from "../../store/useAuthStore";

export function ExtensionHandoffPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const startedRef = useRef(false);

  const code = searchParams.get("code");
  const redirectTo = sanitizeAppRedirect(searchParams.get("redirect"), "/support");

  const exchangeMut = useMutation({
    mutationFn: async (handoffCode: string) => {
      const { data } = await api.post<{
        success: boolean;
        accessToken: string;
        refreshToken: string;
        user: {
          id: string;
          email: string;
          fullName: string;
          role: "admin" | "user";
          status: "active" | "blocked";
        };
      }>("/api/auth/handoff/exchange", { code: handoffCode });
      return data;
    },
    onSuccess: (data) => {
      setSession(data.user, data.accessToken, data.refreshToken);
      navigate(redirectTo, { replace: true });
    },
    onError: () => {
      navigate(`/login?redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
    },
  });

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!code) {
      navigate(`/login?redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
      return;
    }

    exchangeMut.mutate(code);
  }, [code, exchangeMut, navigate, redirectTo]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f7fb] px-4">
      <Spin size="large" />
      <Typography.Paragraph type="secondary" className="!mt-4 text-center">
        {t("auth.handoffLoading")}
      </Typography.Paragraph>
    </div>
  );
}
