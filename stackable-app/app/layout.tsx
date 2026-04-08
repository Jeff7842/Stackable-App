import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Poppins } from 'next/font/google';
import { Inter } from 'next/font/google';
import { ABeeZee } from 'next/font/google';
import { Open_Sans } from 'next/font/google';
import { Plus_Jakarta_Sans, Manrope, Space_Grotesk } from 'next/font/google';
import Acumin from 'next/font/local';
import { ToastProvider } from "../components/toast/ToastProvider";
import { ConfirmationProvider } from "../components/confirmation/ConfirmationProvider";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";
import Script from 'next/script';
import { Space } from "lucide-react";


const acumin = Acumin({
  src: [
    { path: './fonts/Acumin-Variable-Concept.ttf', weight: '200', style: 'thin' },
    { path: './fonts/Acumin-Variable-Concept.ttf', weight: '400', style: 'normal' },
    { path: './fonts/Acumin-Variable-Concept.ttf', weight: '700', style: 'bold' },
  ],
  display: 'swap',
  variable: '--font-Acumin', // Define a CSS variable name
});


const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const openSans = Open_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-open-sans',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const Abeezee = ABeeZee({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-ABeeZee',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stackable Academy",
  description: "Education at scale",
};

function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
          <head>
            {/* Tabler Icons */}
            <link
              rel="stylesheet"
              href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"
            />
    
    {/*/Production version*/}
    <Script src="https://unpkg.com/lucide@latest"></Script>
          </head>
      <body
        className={`${geistSans.variable} ${openSans.variable} ${geistMono.variable} ${Abeezee.variable} ${inter.variable} ${poppins.variable} ${acumin.variable} ${plusJakartaSans.variable} ${manrope.variable} ${spaceGrotesk.variable} antialiased `}>
        <ThemeProvider>
          <ConfirmationProvider>
            <ToastProvider>{children}</ToastProvider>
          </ConfirmationProvider>
        </ThemeProvider>

            {/*Development version*/}
    <Script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></Script>
   

      </body>
      </html>
  );
}
