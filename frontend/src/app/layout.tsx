import type { Metadata } from "next";
import StoreProvider from "../components/layout/StoreProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShopFlow Dashboard",
  description: "E-Commerce Admin Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
