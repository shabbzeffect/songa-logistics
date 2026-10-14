import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ShopProvider } from "@/lib/shop-context";
import HeaderBits from "@/components/header-bits";

export const metadata: Metadata = {
  title: {
    default: "Songa Logistics — Medical courier, food, groceries & e-commerce parcels",
    template: "%s · Songa Logistics",
  },
  description:
    "Songa Logistics is a Kenya-first delivery company: medical courier, food delivery, groceries & shopping, and e-commerce parcel deliveries across Nairobi, Mombasa and Kisumu.",
  keywords: ["delivery Kenya", "medical courier Nairobi", "food delivery Nairobi", "groceries Mombasa", "e-commerce parcels Kisumu", "Songa Logistics"],
  openGraph: {
    title: "Songa Logistics — We move what matters",
    description: "Medical courier, food delivery, groceries & shopping, e-commerce parcels. Nairobi · Mombasa · Kisumu.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const wa = process.env.NEXT_PUBLIC_WHATSAPP ?? "";
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <ShopProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded focus:bg-sun-400 focus:px-3 focus:py-1">
            Skip to content
          </a>
          <header className="sticky top-0 z-40 border-b border-forest-950/10 bg-forest-950 text-cream-50">
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
              <Link href="/" className="flex items-center gap-2" aria-label="Songa Logistics home">
                <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-coral-500 text-xl font-black">S</span>
                <span className="font-display text-2xl font-black tracking-tight">
                  songa
                  <span className="ml-2 hidden text-xs font-semibold uppercase tracking-widest text-cream-200/80 sm:inline">
                    Logistics · We move what matters
                  </span>
                </span>
              </Link>
              <nav className="ml-auto flex items-center gap-1 text-sm font-semibold" aria-label="Primary">
                <Link className="rounded-lg px-3 py-2 hover:bg-white/10" href="/browse">Browse</Link>
                <Link className="rounded-lg px-3 py-2 hover:bg-white/10" href="/parcel">Send parcel</Link>
                <Link className="hidden rounded-lg px-3 py-2 hover:bg-white/10 sm:inline" href="/partner">Partner</Link>
                <Link className="hidden rounded-lg px-3 py-2 hover:bg-white/10 md:inline" href="/orders">My orders</Link>
                <Link className="rounded-lg px-3 py-2 hover:bg-white/10" href="/login">Sign in</Link>
              </nav>
              <HeaderBits />
            </div>
          </header>
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6">
            {children}
          </main>
          <footer className="border-t border-forest-950/10 bg-forest-950 text-cream-100">
            <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-4">
              <div>
                <p className="font-display text-xl font-black text-cream-50">songa logistics</p>
                <p className="mt-1 text-sm text-cream-200/80">We move what matters.</p>
                <p className="mt-2 text-xs text-cream-200/60">Demo catalogue — sample shops &amp; photos until real partners join.</p>
              </div>
              <nav aria-label="Explore">
                <p className="text-xs font-bold uppercase tracking-wider text-cream-200/60">Deliveries</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li><Link className="hover:underline" href="/browse?category=food">Food delivery</Link></li>
                  <li><Link className="hover:underline" href="/browse?category=grocery">Groceries &amp; shopping</Link></li>
                  <li><Link className="hover:underline" href="/browse?category=medical">Medical courier</Link></li>
                  <li><Link className="hover:underline" href="/parcel">E-commerce parcels</Link></li>
                  <li><Link className="hover:underline" href="/orders">Track my order</Link></li>
                </ul>
              </nav>
              <nav aria-label="Work">
                <p className="text-xs font-bold uppercase tracking-wider text-cream-200/60">Work with Songa</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li><Link className="hover:underline" href="/partner">Become a partner</Link></li>
                  <li><Link className="hover:underline" href="/merchant">Merchant console</Link></li>
                  <li><Link className="hover:underline" href="/courier">Courier workspace</Link></li>
                  <li><Link className="hover:underline" href="/hq">Operations HQ</Link></li>
                </ul>
              </nav>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-cream-200/60">Support</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li><Link className="hover:underline" href="/support">Help &amp; policies</Link></li>
                  {wa && <li><a className="hover:underline" href={`https://wa.me/${wa}`}>WhatsApp us</a></li>}
                  <li><Link className="hover:underline" href="/support#contact">Call us</Link></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-white/10 py-4 text-center text-xs text-cream-200/60">
              Prices in Kenyan Shillings (KSh). Times shown in Africa/Nairobi.
            </div>
          </footer>
        </ShopProvider>
      </body>
    </html>
  );
}
