import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CarFind AI — Find Your Perfect Car",
  description:
    "Smart, personalised car recommendations for the Indian market. Go from confused to confident in 60 seconds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Google Fonts loaded via <link> so next/font network block doesn't affect build */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
