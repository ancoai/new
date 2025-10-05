import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { Providers } from "@/src/state/providers";

export const metadata: Metadata = {
  title: "Thinking Chat",
  description: "Multi-model chat client with thinking pipeline",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
