import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'rippd',
  description: 'Board games, couch co-op and online multiplayer without accounts.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
