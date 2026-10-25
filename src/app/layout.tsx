import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// braincanndy type: Unbounded for headlines, DM Sans for everything else. Self-hosted (no runtime call
// to Google Fonts), with metric-matched fallbacks so text doesn't jump when the fonts arrive.
const display = localFont({
  src: "../../node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2",
  variable: "--font-unbounded",
  weight: "200 900",
  display: "swap",
});
const body = localFont({
  src: "../../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2",
  variable: "--font-dmsans",
  weight: "100 1000",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Foolproof",
  description: "Search for places to eat, ranked by how trustworthy their reviews look. Fake reviews and prompt injection can't fool it.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#041A1D",
};

// Runs before the first paint: applies the visitor's "motion off" choice, and marks shared search
// links (?q=) so the home screen doesn't flash before the results appear.
const BOOT = `try{if(localStorage.getItem("foolproof.motion")==="off")document.documentElement.dataset.motion="off"}catch(e){}if(/[?&]q=./.test(location.search))document.documentElement.dataset.boot="results"`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
