import type { ReactNode } from "react";

type AuthShellProps = {
  /** Left / top panel (demo, marketing) */
  aside: ReactNode;
  /** Main card (form) */
  children: ReactNode;
};

export function AuthShell({ aside, children }: AuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.18), transparent 45%),
            radial-gradient(circle at 80% 10%, rgba(99, 102, 241, 0.15), transparent 40%),
            radial-gradient(circle at 50% 90%, rgba(14, 165, 233, 0.12), transparent 50%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2394a3b8' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-[1] mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-10 md:flex-row md:items-center md:justify-center md:gap-12 md:px-8">
        <div className="flex-1 md:max-w-md">{aside}</div>
        <div className="flex w-full flex-1 justify-center md:max-w-md">{children}</div>
      </div>
    </div>
  );
}
