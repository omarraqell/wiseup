"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Define routes where Header and Footer should be hidden
  const isAuthOrAdminRoute = 
    ["/login", "/signup", "/forgot-password", "/reset-password"].includes(pathname) ||
    pathname.startsWith("/admin");

  if (isAuthOrAdminRoute) {
    return <main className="flex-grow w-full min-h-screen flex flex-col">{children}</main>;
  }

  return (
    <>
      <Header />
      <main className="flex-grow w-full">{children}</main>
      <Footer />
    </>
  );
}
