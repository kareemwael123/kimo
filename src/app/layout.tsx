import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "بوص — صاحبك الذكي",
  description: "روبوت ذكي بيشعر، يسمعك، ويرد عليك بالصوت.",
  keywords: ["روبوت", "ذكاء اصطناعي", "صديق ذكي", "صوت", "Arabic AI"],
  authors: [{ name: "Boss Robot" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "بوص — صاحبك الذكي",
    description: "روبوت ذكي بيشعر، يسمعك، ويرد عليك بالصوت.",
    url: "https://chat.z.ai",
    siteName: "بوص",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "بوص — صاحبك الذكي",
    description: "روبوت ذكي بيشعر، يسمعك، ويرد عليك بالصوت.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
