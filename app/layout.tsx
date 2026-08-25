import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'منصة البيانات المالية للمستشفيات — وزارة الصحة والسكان',
  description: 'منصة إلكترونية لتجميع ومتابعة البيانات المالية لمستشفيات وزارة الصحة والسكان المصرية',
  keywords: 'وزارة الصحة, مستشفيات, بيانات مالية, إيرادات, مصروفات',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}

