import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.BRAND_NAME ?? "Ravi Raman",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/eb-garamond-var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/archivo-var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <div className="sheet">
          <div className="flex-1">{children}</div>
          <footer className="border-t border-rule px-5 py-6 text-xs text-ink-faint sm:px-12">
            © {process.env.FOOTER_NAME ?? process.env.BRAND_NAME ?? "Ravi Raman"} {new Date().getFullYear()}
          </footer>
        </div>
      </body>
    </html>
  );
}
