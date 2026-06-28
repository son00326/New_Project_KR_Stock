import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// 토스 계열 한글 오픈폰트 Pretendard (self-host · variable · no CLS)
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920",
  fallback: [
    "-apple-system",
    "BlinkMacSystemFont",
    "Apple SD Gothic Neo",
    "Malgun Gothic",
    "system-ui",
    "sans-serif",
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "주픽 JooPick - 똑똑한 주식 픽 | AI 기반 주식 분석 플랫폼",
  description:
    "초보부터 전문가까지, 누구나 쉽게 이해할 수 있는 AI 주식 분석 리포트. Fundamental, Technical 분석과 Peer Group 비교까지.",
  keywords: ["주식", "투자", "분석", "AI", "주픽", "JooPick", "주식분석", "주식픽"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
