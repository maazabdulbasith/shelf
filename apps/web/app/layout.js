import "./globals.css";

export const metadata = {
  title: "Shelf",
  description: "Find the screenshot you remember.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
