import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NextTask",
  description: "Task and schedule planning for NextTask",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
