import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Cartographer — A sitemap-to-manifest converter",
  description:
    "Crawl a WordPress visual sitemap page and export every internal link as a clean, sorted manifest.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,700;0,9..144,900;1,9..144,400;1,9..144,500;1,9..144,700&family=JetBrains+Mono:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
