import { useEffect, useState } from "react";

import { api } from "../../lib/api";

type Props = {
  url: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
};

export function BookletPageImage({ url, alt, className, style }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      setFailed(false);
      setSrc(null);
      try {
        const res = await api.get(url, { responseType: "blob" });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  const boxStyle: React.CSSProperties = {
    width: "100%",
    maxHeight: 280,
    background: "#f1f5f9",
    borderRadius: 8,
    ...style,
  };

  if (failed) {
    return (
      <div
        style={{
          ...boxStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          fontSize: 12,
          minHeight: 120,
        }}
      >
        Không tải được ảnh (thử đăng nhập lại)
      </div>
    );
  }

  if (!src) {
    return (
      <div
        style={{
          ...boxStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#94a3b8",
          fontSize: 12,
          minHeight: 120,
        }}
      >
        Đang tải ảnh…
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        width: "100%",
        maxHeight: 280,
        objectFit: "contain",
        background: "#f1f5f9",
        borderRadius: 8,
        ...style,
      }}
    />
  );
}
