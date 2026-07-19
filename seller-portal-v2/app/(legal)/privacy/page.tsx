import type { Metadata } from 'next';
import { DocHeader, TemplateNotice, H2, H3, P, UL } from '@/components/legal/doc';

export const metadata: Metadata = {
  title: 'Privacy Policy · Gaarsii Seller Portal',
  description: 'How Gaarsii collects, uses, and protects your personal information.',
};

export default function PrivacyPage() {
  return (
    <>
      <DocHeader title="Privacy Policy" updated="19 July 2026" />
      <TemplateNotice />

      <P>
        This Privacy Policy explains how Gaarsii Global Ltd (&ldquo;Gaarsii&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, shares, and protects personal
        information when you use the Gaarsii marketplace and seller portal (the
        &ldquo;Platform&rdquo;). By using the Platform, you agree to the practices described
        here.
      </P>

      <H2>1. Information We Collect</H2>
      <H3>Information you provide</H3>
      <UL>
        <li>Account details — name, email, password, business name, and contact information.</li>
        <li>Verification and payout details — tax identifiers, bank or payout account information, and documents needed to verify your identity or business.</li>
        <li>Content you upload — product listings, images, descriptions, and messages.</li>
        <li>Support communications — information you share when you contact us.</li>
      </UL>
      <H3>Information collected automatically</H3>
      <UL>
        <li>Device and usage data — IP address, browser type, pages viewed, and actions taken.</li>
        <li>Cookies and similar technologies (see section 5).</li>
      </UL>
      <H3>Information from third parties</H3>
      <UL>
        <li>Payment processors, identity-verification providers, fraud-prevention services, and analytics providers.</li>
      </UL>

      <H2>2. How We Use Your Information</H2>
      <UL>
        <li>Operate, maintain, and secure the Platform and your account.</li>
        <li>Process orders, payments, and payouts, and prevent fraud.</li>
        <li>Provide customer support and respond to your requests.</li>
        <li>Send service, security, and (where permitted) marketing communications.</li>
        <li>Analyze and improve the Platform.</li>
        <li>Comply with legal obligations and enforce our terms.</li>
      </UL>

      <H2>3. Legal Bases for Processing</H2>
      <P>
        Where applicable law (such as the GDPR) requires it, we process personal information on
        the bases of: performance of a contract with you; our legitimate interests (such as
        securing and improving the Platform); your consent (which you may withdraw); and
        compliance with legal obligations.
      </P>

      <H2>4. How We Share Information</H2>
      <UL>
        <li><strong>Service providers</strong> — hosting, payment processing, analytics, and support vendors acting on our instructions.</li>
        <li><strong>Buyers</strong> — the limited store and order information necessary to complete transactions.</li>
        <li><strong>Legal &amp; safety</strong> — where required by law or legal process, or to protect rights, safety, and property.</li>
        <li><strong>Business transfers</strong> — in connection with a merger, acquisition, or sale of assets.</li>
      </UL>
      <P>We do not sell your personal information for money.</P>

      <H2>5. Cookies &amp; Tracking Technologies</H2>
      <P>
        We use cookies and similar technologies to keep you signed in, remember preferences,
        secure the Platform, and understand usage. You can control cookies through your browser
        settings; disabling some cookies may affect functionality.
      </P>

      <H2>6. Data Retention</H2>
      <P>
        We retain personal information for as long as your account is active and as needed to
        provide the Platform, then for the period required to meet legal, tax, accounting, and
        dispute-resolution obligations, after which we delete or anonymize it.
      </P>

      <H2>7. Data Security</H2>
      <P>
        We use technical and organizational measures designed to protect personal information,
        including encryption in transit, access controls, and monitoring. No method of
        transmission or storage is completely secure, and we cannot guarantee absolute security.
      </P>

      <H2>8. Your Rights &amp; Choices</H2>
      <P>
        Depending on your location, you may have the right to access, correct, delete, or port
        your personal information; to object to or restrict certain processing; and to withdraw
        consent. To exercise these rights, contact us at support@gaarsiiglobal.com. You may
        also have the right to lodge a complaint with your local data-protection authority.
      </P>

      <H2>9. International Data Transfers</H2>
      <P>
        Your information may be processed in countries other than your own. Where we transfer
        personal information across borders, we use appropriate safeguards (such as standard
        contractual clauses) as required by applicable law.
      </P>

      <H2>10. Children&rsquo;s Privacy</H2>
      <P>
        The Platform is not directed to children under 13, and we do not knowingly collect
        their personal information. If you believe a child has provided us information, contact
        us and we will delete it.
      </P>

      <H2>11. Third-Party Links &amp; Services</H2>
      <P>
        The Platform may link to or integrate third-party services with their own privacy
        practices. We are not responsible for those practices; review their policies before
        providing information.
      </P>

      <H2>12. Changes to This Policy</H2>
      <P>
        We may update this Policy from time to time. We will post the updated version with a new
        &ldquo;Last updated&rdquo; date and, for material changes, provide additional notice
        through the Platform or by email.
      </P>

      <H2>13. Contact Us</H2>
      <P>
        For privacy questions or requests, contact us at support@gaarsiiglobal.com or Gaarsii
        Global Ltd, Street, City, Country.
      </P>
    </>
  );
}