import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LingoAgent",
  description: "A multilingual adoption accelerator — an autonomous agent pipeline that removes friction between wanting multilingual support and having a working implementation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
