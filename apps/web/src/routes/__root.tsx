import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { MainNav } from "@/components/MainNav";
import { Toaster } from "sonner";
import "../styles.css";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideNav = pathname === "/display";

  return (
    <div className="min-h-screen">
      {!hideNav && <MainNav />}
      <Outlet />
      <Toaster richColors position="top-center" />
    </div>
  );
}
