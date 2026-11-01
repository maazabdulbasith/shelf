import "./globals.css";

export const metadata = {
  title: "Shelf — The Only Shelf for Your Screenshots",
  description: "Local-first visual search wall with on-device OCR. Find the screenshot you remember with OCR, pgvector, and hybrid RRF.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* On-device WebAssembly OCR engine */}
        <script
          id="tesseract-cdn-script"
          src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"
          async
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
