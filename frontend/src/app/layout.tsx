import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider } from "@/context/AuthContext";


const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "WISEUP - متجر الأدوات اليدوية | Industrial Hand Tools",
  description:
    "أدوات صناعية عالية الجودة للمحترفين. متانة لا تضاهى وأداء يثق به الخبراء. Premium industrial hand tools for professionals.",
};

import LayoutWrapper from "@/components/LayoutWrapper";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${inter.variable} ${oswald.variable} h-full`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased bg-[#fff8f7] text-[#2a1614]">
        <AuthProvider>
          <LanguageProvider>
            <LayoutWrapper>{children}</LayoutWrapper>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
