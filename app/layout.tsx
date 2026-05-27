import type { Metadata } from "next";
import { Syne, DM_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "TradeDesk — AI Trading Command Center",
  description:
    "An AI-powered stock trading command center with voice assistant, technical analysis, fundamental analysis, and portfolio tracking.",
};

/**
 * Inline script that reads the theme preference from localStorage BEFORE the
 * first paint — this prevents any light/dark flash on page load.
 */
const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('td-theme');
    if (t === 'light') document.documentElement.classList.add('light');
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${dmMono.variable} h-full`} suppressHydrationWarning>
      {/* Theme init script — must run before body paint */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
