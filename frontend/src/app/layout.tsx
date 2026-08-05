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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${outfit.variable} antialiased bg-[#0B0F17] text-[#F3F4F6]`}>
        {children}
      </body>
    </html>
  );
}
