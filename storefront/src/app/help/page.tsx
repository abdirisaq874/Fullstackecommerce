import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui';
import { SITE_NAME } from '@/lib/utils';
import { Truck, RefreshCcw, ShieldCheck, FileText, HelpCircle, Mail } from 'lucide-react';

export const metadata: Metadata = { title: 'Help & Policies' };

const FAQ = [
  { q: 'How long does delivery take?', a: 'Standard delivery is 3–7 business days. Express options are shown at checkout based on your destination.' },
  { q: 'How do I track my order?', a: 'Go to Account → Orders and open any order to see its live status timeline.' },
  { q: 'What is your return policy?', a: 'Most items can be returned within 30 days of delivery. Start a return from the order page.' },
  { q: 'Which payment methods do you accept?', a: 'All major cards via our secure Stripe checkout.' },
  { q: 'Do you ship internationally?', a: 'Yes — shipping availability and rates are calculated at checkout for your country.' },
];

const SECTIONS = [
  { id: 'shipping', icon: Truck, title: 'Shipping', body: 'We ship worldwide. Orders over $50 qualify for free standard shipping. Rates and delivery estimates are shown at checkout based on destination and weight.' },
  { id: 'returns', icon: RefreshCcw, title: 'Returns & refunds', body: 'You have 30 days from delivery to request a return. Open the order in your account and choose “Request return”. Refunds are issued to your original payment method once the item is received and inspected.' },
  { id: 'privacy', icon: ShieldCheck, title: 'Privacy', body: `${SITE_NAME} only collects the data needed to fulfil your orders and improve your experience. We never sell your personal information. Payment details are handled securely by Stripe and never touch our servers.` },
  { id: 'terms', icon: FileText, title: 'Terms of service', body: 'By using this store you agree to shop in good faith, provide accurate information, and comply with applicable laws. Prices and availability may change without notice.' },
  { id: 'about', icon: HelpCircle, title: `About ${SITE_NAME}`, body: `${SITE_NAME} is a bold, modern marketplace built for everyone — with multilingual smart search and a fast, friendly checkout.` },
];

export default function HelpPage() {
  return (
    <Container className="py-10">
      <div className="mb-10 rounded-3xl bg-brand-gradient p-8 text-white shadow-pop">
        <h1 className="font-display text-4xl font-extrabold">Help center</h1>
        <p className="mt-2 max-w-lg text-white/90">Answers about shipping, returns, payments and your account.</p>
      </div>

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="mb-5 font-display text-2xl font-extrabold">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-2xl border border-line bg-surface p-5 shadow-card">
              <summary className="flex cursor-pointer items-center justify-between font-bold">
                {item.q}
                <span className="text-brand transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-muted-fg">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Policy sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <section key={s.id} id={s.id} className="scroll-mt-24 rounded-2xl border border-line bg-surface p-6 shadow-card">
              <h3 className="flex items-center gap-2 font-display text-xl font-bold"><Icon className="h-5 w-5 text-brand" /> {s.title}</h3>
              <p className="mt-3 text-muted-fg">{s.body}</p>
            </section>
          );
        })}

        {/* Contact */}
        <section id="contact" className="scroll-mt-24 rounded-2xl border border-line bg-surface p-6 shadow-card md:col-span-2">
          <h3 className="flex items-center gap-2 font-display text-xl font-bold"><Mail className="h-5 w-5 text-brand" /> Contact us</h3>
          <p className="mt-3 text-muted-fg">
            Need a hand? Sign in and message a seller directly from any product, or reach our team at{' '}
            <a href="mailto:support@suuq.example" className="font-bold text-brand hover:underline">support@suuq.example</a>.
            For order issues, open the order in <Link href="/account/orders" className="font-bold text-brand hover:underline">your account</Link>.
          </p>
        </section>
      </div>
    </Container>
  );
}
