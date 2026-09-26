"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PageSkeleton } from "./PageSkeleton";

function skeletonVariant(pathname: string) {
  if (pathname.startsWith("/token/")) return "detail" as const;
  if (
    pathname === "/" ||
    pathname.startsWith("/rewards") ||
    pathname.startsWith("/leaderboard") ||
    pathname.startsWith("/staking") ||
    pathname.startsWith("/account")
  ) {
    return "table" as const;
  }
  if (
    pathname.startsWith("/create") ||
    pathname.startsWith("/devlock") ||
    pathname.startsWith("/create-staking")
  ) {
    return "form" as const;
  }
  return "default" as const;
}

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [pendingPath, setPendingPath] = useState(pathname);

  useEffect(() => {
    window.scrollTo(0, 0);
    setPending(false);
  }, [pathname]);

  useEffect(() => {
    function isModified(event: MouseEvent) {
      return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
    }

    function onClick(event: MouseEvent) {
      if (isModified(event)) return;
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
        setPendingPath(url.pathname);
        setPending(true);
      } catch {
        // ignore invalid href
      }
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <div key={pathname} className={`route-swap ${pending ? "is-pending" : ""}`}>
      {pending ? <PageSkeleton variant={skeletonVariant(pendingPath)} /> : children}
    </div>
  );
}
