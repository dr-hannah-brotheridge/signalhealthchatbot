import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from "./ClientLayout"; // We will create this small helper file

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  title: "SignalHealth",
  description: "Your Proactive AI Health Companion",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f766e" />
      </head>
      <body className="min-h-full flex flex-col">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}