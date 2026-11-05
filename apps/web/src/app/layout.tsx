import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ISEEYOU — OSINT & Attack Surface Command Center',
  description: 'All-in-one automated reconnaissance and attack surface intelligence platform.',
  icons: {
    icon: '/logo.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
