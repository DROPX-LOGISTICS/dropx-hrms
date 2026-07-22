import type { Metadata } from "next";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/navigation-progress";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DropX People", template: "%s - DropX People" },
  description: "DropX People human resource management system",
  icons: { icon: "/favicon.png" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Suspense fallback={null}><NavigationProgress /></Suspense>{children}</body></html>;
}
