import './globals.css';

export const metadata = { title: 'Liquid Glass — iOS Navigation Kit v2' };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function RootLayout({ children }) {
  return <html lang="id"><body>{children}</body></html>;
}
