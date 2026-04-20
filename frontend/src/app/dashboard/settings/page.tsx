"use client";
import { useState } from "react";
import { Button, Card, CardHeader, Input } from "../../../../components/ui";

interface SettingsSection {
  title: string;
  fields: { label: string; key: string; value: string; type?: string; hint?: string }[];
}

const settingsSections: SettingsSection[] = [
  {
    title: "Store Information",
    fields: [
      { label: "Store Name", key: "storeName", value: "ShopFlow Store" },
      { label: "Store Email", key: "storeEmail", value: "hello@shopflow.com", type: "email" },
      { label: "Support Email", key: "supportEmail", value: "support@shopflow.com", type: "email" },
      { label: "Store Phone", key: "storePhone", value: "+1 (555) 123-4567" },
      { label: "Timezone", key: "timezone", value: "America/New_York" },
    ],
  },
  {
    title: "Payment Settings",
    fields: [
      { label: "Stripe Secret Key", key: "stripeSecret", value: "sk_test_••••4242", type: "password", hint: "Starts with sk_test_ or sk_live_" },
      { label: "Stripe Webhook Secret", key: "stripeWebhook", value: "whsec_••••1234", type: "password" },
      { label: "Default Currency", key: "currency", value: "USD" },
    ],
  },
  {
    title: "Email Configuration",
    fields: [
      { label: "SMTP Host", key: "smtpHost", value: "smtp.sendgrid.net" },
      { label: "SMTP Port", key: "smtpPort", value: "587" },
      { label: "SMTP Username", key: "smtpUser", value: "apikey" },
      { label: "SMTP Password", key: "smtpPass", value: "••••••••", type: "password" },
      { label: "From Email", key: "fromEmail", value: "noreply@shopflow.com", type: "email" },
      { label: "From Name", key: "fromName", value: "ShopFlow" },
    ],
  },
  {
    title: "Shipping",
    fields: [
      { label: "Default Shipping Cost", key: "defaultShipping", value: "9.99", hint: "Applied when no shipping rules match" },
      { label: "Free Shipping Threshold", key: "freeShipThreshold", value: "75.00", hint: "Orders above this amount get free shipping" },
    ],
  },
];

export default function SettingsPage() {
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    settingsSections.forEach((s) => s.fields.forEach((f) => { initial[f.key] = f.value; }));
    return initial;
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // In production: POST /admin/settings with formData
    console.log("Saving settings:", formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">Settings</h1>
          <p className="text-[10px] text-gray-400 mt-0.5">Configure your store settings.</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-[10px] text-emerald-500 font-semibold">Settings saved ✓</span>}
          <Button onClick={handleSave}>Save All Settings</Button>
        </div>
      </div>

      <div className="space-y-4">
        {settingsSections.map((section) => (
          <Card key={section.title} padding={false}>
            <CardHeader>{section.title}</CardHeader>
            <div className="p-5 space-y-3">
              {section.fields.map((field) => (
                <div key={field.key} className="flex items-start gap-4">
                  <label className="text-[10px] text-gray-500 font-medium w-40 shrink-0 pt-2">{field.label}</label>
                  <div className="flex-1">
                    <Input
                      type={field.type === "password" ? "password" : "text"}
                      value={formData[field.key]}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      hint={field.hint}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
