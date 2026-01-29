import type { ReactNode } from "react";
import logo from "../assets/Astro_Devaraj_Logo.png";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#fbf4ea] via-[#f4e7d8] to-[#ead7c2] text-neutral-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(89,60,30,0.12),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(89,60,30,0.08),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.6),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:radial-gradient(#593c1e_0.5px,transparent_0.5px)] [background-size:18px_18px]" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-8 sm:max-w-lg sm:px-6">
        <section className="w-full rounded-[28px] border border-[#eadfce] bg-white/75 p-4 shadow-[0_24px_70px_-40px_rgba(89,60,30,0.5)] backdrop-blur sm:p-6">
          <div className="rounded-2xl border border-[#f2e6d6] bg-white/70 px-3 py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-20 items-center justify-center rounded-2xl bg-white/90">
                <img
                  src={logo}
                  alt="Astro Deva-Raj"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate font-heading text-sm font-black text-neutral-950">
                  The Life Forecast
                </p>
                <p className="truncate text-[11px] font-medium text-neutral-600">
                  Admin
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#ead7c2] bg-white/70 px-3 py-1 text-[11px] font-semibold text-[#593c1e]">
            🔒 Secure Admin Access
          </div>

          <div className="mt-4 space-y-1">
            <h1 className="font-heading text-xl font-black text-neutral-950 sm:text-2xl">
              {title}
            </h1>
            <p className="text-sm text-neutral-600">{subtitle}</p>
          </div>

          <div className="mt-4">{children}</div>

          {footer && <div className="mt-4 text-xs text-neutral-500">{footer}</div>}
        </section>
      </main>
    </div>
  );
}
