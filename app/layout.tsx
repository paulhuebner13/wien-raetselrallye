import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wien Rätselrallye',
  description: 'Private Rätselrallye durch Wien',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
