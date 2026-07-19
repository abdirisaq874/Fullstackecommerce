import type { Metadata } from 'next';
import { DocHeader, TemplateNotice, H2, P, UL } from '@/components/legal/doc';

export const metadata: Metadata = {
  title: 'Terms of Service · Gaarsii Seller Portal',
  description: 'The terms that govern your use of the Gaarsii marketplace and seller portal.',
};

export default function TermsPage() {
  return (
    <>
      <DocHeader title="Terms of Service" updated="19 July 2026" />
      <TemplateNotice />

      <P>
        These Terms of Service (&ldquo;Terms&rdquo;) form a binding agreement between you
        (&ldquo;Seller&rdquo;, &ldquo;you&rdquo;) and Gaarsii Global Ltd (&ldquo;Gaarsii&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;), operator of the Gaarsii marketplace and seller
        portal (the &ldquo;Platform&rdquo;). By creating an account, checking the acceptance
        box, or listing products, you agree to these Terms. If you do not agree, do not use
        the Platform.
      </P>

      <H2>1. Definitions</H2>
      <UL>
        <li><strong>Platform</strong> — the Gaarsii marketplace, seller portal, APIs, and related services.</li>
        <li><strong>Seller</strong> — a person or business that registers to list and sell products.</li>
        <li><strong>Buyer</strong> — an end customer who purchases products through the Platform.</li>
        <li><strong>Listing</strong> — a product you offer for sale, including its images, price, and description.</li>
        <li><strong>Content</strong> — any text, images, data, or materials you upload to the Platform.</li>
      </UL>

      <H2>2. Eligibility &amp; Account Registration</H2>
      <P>
        To sell on the Platform you must be at least 18 years old (or the age of majority in
        your jurisdiction) and able to form a binding contract. If you register on behalf of a
        business, you represent that you are authorized to bind that business to these Terms.
      </P>
      <P>
        You agree to provide accurate, current, and complete registration information and to
        keep it up to date. We may refuse, suspend, or revoke any account at our reasonable
        discretion where these Terms are violated or where required by law.
      </P>

      <H2>3. Account Security</H2>
      <P>
        You are responsible for safeguarding your credentials and for all activity under your
        account. Notify us immediately at support@gaarsiiglobal.com of any unauthorized use.
        We are not liable for losses arising from your failure to secure your account.
      </P>

      <H2>4. Seller Responsibilities &amp; Listings</H2>
      <UL>
        <li>Provide accurate, non-misleading titles, descriptions, images, pricing, and availability for every Listing.</li>
        <li>List only products you have the legal right to sell, that comply with all applicable laws, and that do not infringe third-party intellectual property.</li>
        <li>Honor the price and terms shown to Buyers at the time of purchase.</li>
        <li>Maintain accurate inventory and promptly update or remove Listings that are unavailable.</li>
        <li>Ensure all product images and content are your own or properly licensed.</li>
      </UL>

      <H2>5. Prohibited Products &amp; Conduct</H2>
      <P>
        You may not list or sell illegal, counterfeit, stolen, recalled, hazardous, or
        otherwise restricted items, or anything that violates applicable law or third-party
        rights. You may not manipulate reviews or search rankings, engage in fraud, scrape the
        Platform without permission, interfere with its operation, or misuse other users&rsquo;
        data.
      </P>

      <H2>6. Orders, Fulfillment &amp; Shipping</H2>
      <P>
        You are responsible for processing, packaging, and shipping orders promptly and in line
        with the delivery estimates shown to Buyers, and for providing valid tracking where
        applicable. Risk of loss and title pass according to the shipping terms you specify,
        consistent with applicable law.
      </P>

      <H2>7. Returns, Refunds &amp; Cancellations</H2>
      <P>
        You must maintain a clear, lawful returns and refund policy and honor Buyers&rsquo;
        statutory rights. Where you fail to resolve a legitimate Buyer complaint, we may
        mediate and, where appropriate, issue refunds and charge them back to you.
      </P>

      <H2>8. Fees, Payments &amp; Payouts</H2>
      <P>
        We may charge commissions, listing fees, payment-processing fees, or subscription fees
        as described in your account or a separate fee schedule. Fees are exclusive of taxes
        unless stated. Payouts of Buyer proceeds — net of applicable fees, refunds, and
        chargebacks — are remitted to your designated payout method on the schedule we publish.
        We may withhold or delay payouts to investigate suspected fraud or policy violations.
      </P>

      <H2>9. Taxes</H2>
      <P>
        You are solely responsible for determining, collecting, reporting, and remitting all
        taxes arising from your sales, except where we are legally required to collect them on
        your behalf. You remain responsible for your own income and business taxes.
      </P>

      <H2>10. Intellectual Property &amp; Content License</H2>
      <P>
        The Platform — including its software, design, and trademarks — is owned by Gaarsii and
        its licensors. We grant you a limited, non-exclusive, non-transferable, revocable
        license to use the Platform to operate your store.
      </P>
      <P>
        You retain ownership of your Content. You grant us a worldwide, non-exclusive,
        royalty-free license to host, display, reproduce, and distribute your Content as needed
        to operate, market, and promote the Platform and your Listings. You represent that you
        hold all rights necessary to grant this license.
      </P>

      <H2>11. Platform Role &amp; Disclaimers</H2>
      <P>
        Gaarsii provides a marketplace that connects Sellers and Buyers. Unless expressly
        stated, we are not the seller of record and are not a party to the contract of sale
        between you and a Buyer. The Platform is provided &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo; without warranties of any kind, express or implied, including
        merchantability, fitness for a particular purpose, and non-infringement, to the fullest
        extent permitted by law.
      </P>

      <H2>12. Limitation of Liability</H2>
      <P>
        To the maximum extent permitted by law, Gaarsii and its affiliates will not be liable
        for any indirect, incidental, special, consequential, or punitive damages, or for lost
        profits, revenue, or data. Our aggregate liability for any claim relating to the
        Platform will not exceed the total fees you paid to us in the three (3) months
        preceding the event giving rise to the claim.
      </P>

      <H2>13. Indemnification</H2>
      <P>
        You agree to indemnify and hold harmless Gaarsii, its affiliates, and their officers,
        employees, and agents from any claims, damages, liabilities, and expenses (including
        reasonable legal fees) arising out of your Listings, products, Content, breach of these
        Terms, or violation of any law or third-party right.
      </P>

      <H2>14. Suspension &amp; Termination</H2>
      <P>
        You may close your account at any time. We may suspend or terminate your access, remove
        Listings, or withhold payouts if you breach these Terms, create risk or legal exposure,
        or where required by law. Provisions that by their nature should survive termination
        (including fees owed, intellectual property, disclaimers, limitation of liability, and
        indemnification) will survive.
      </P>

      <H2>15. Changes to These Terms</H2>
      <P>
        We may update these Terms from time to time. Material changes will be notified through
        the Platform or by email and take effect on the date stated. Your continued use after
        the effective date constitutes acceptance.
      </P>

      <H2>16. Governing Law &amp; Dispute Resolution</H2>
      <P>
        These Terms are governed by the laws of Somalia, without regard to conflict-of-law
        rules. The parties submit to the exclusive jurisdiction of the courts located in
        Somalia, except that either party may seek injunctive relief where necessary to
        protect its rights.
      </P>

      <H2>17. Contact</H2>
      <P>
        Questions about these Terms? Contact us at support@gaarsiiglobal.com or Gaarsii Global
        Ltd, Street, City, Country.
      </P>
    </>
  );
}