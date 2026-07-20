import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: { default: "DropX HRMS", template: "%s · DropX HRMS" }, description: "DropX Logistics human resource management system" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
