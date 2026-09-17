/** Root layout and browser metadata shared by every application route. */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codebase Archaeologist",
  description: "Understand how your codebase became what it is.",
};

/** Wraps all pages with the application document shell. */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html><body>{children}</body></html>
      
    );
}
