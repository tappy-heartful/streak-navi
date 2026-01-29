import type { Metadata } from "next";
import "./globals.css";
import Header from "../components/Header";
import Footer from "../components/Footer"; // 追加

export const metadata: Metadata = {
  title: "HOME | SSJO",
  description: "Swing Streak Jazz Orchestra Official Store & Reserve",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
      </head>
      <body>
        <Header />
        {children}
        <Footer /> {/* Headerと対になるように配置 */}
      </body>
    </html>
  );
}