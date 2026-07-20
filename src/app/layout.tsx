import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DropX People", template: "%s - DropX People" },
  description: "DropX People human resource management system",
  icons: { icon: "/favicon.png" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
