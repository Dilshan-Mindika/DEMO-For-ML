import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ApexPulse - Enterprise Laptop Lifecycle & RUL Prediction",
  description: "Real-time hardware telemetry collector and XGBoost Remaining Useful Life (RUL) predictive maintenance dashboard.",
  icons: {
    icon: [
      { url: "/icon.png?v=1.1.2", type: "image/png" },
      { url: "/favicon.ico?v=1.1.2", type: "image/x-icon" },
    ],
    shortcut: "/favicon.ico?v=1.1.2",
    apple: "/icon.png?v=1.1.2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/icon.png?v=1.1.2" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico?v=1.1.2" />
        <link rel="shortcut icon" href="/favicon.ico?v=1.1.2" />
        <link rel="apple-touch-icon" href="/icon.png?v=1.1.2" />
      </head>
      <body className={`${inter.variable} ${outfit.variable} antialiased bg-[#0B0F17] text-[#F3F4F6]`}>
        {children}
      </body>
    </html>
  );
}
