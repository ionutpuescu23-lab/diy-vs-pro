export const metadata = { title: "Refund Policy — DIY vs PRO" };

export default function RefundPage() {
  return (
    <main style={{ background: "#0B0D10", color: "#F1F5F9", minHeight: "100vh" }} className="px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <a href="/" className="text-sm underline" style={{ color: "#60A5FA" }}>← Back to DIY vs PRO</a>
        <h1 className="text-2xl font-black uppercase tracking-wide mt-4">Refund Policy</h1>
        <p className="text-xs mt-1 mb-8" style={{ color: "#94A3B8" }}>Last updated: 9 July 2026</p>

        <Section title="1. Digital goods, delivered immediately">
          <P>
            "Unlock full access" and "Unlock Design Studio" are one-time purchases for digital services that are
            unlocked immediately on your device once payment completes.
          </P>
        </Section>

        <Section title="2. Your cancellation rights">
          <P>
            Under the UK Consumer Contracts Regulations 2013, you normally have a 14-day right to cancel a digital
            purchase. By choosing to unlock a feature, you acknowledge that access begins immediately and you
            expressly agree to waive the 14-day cancellation right once you've started using the unlocked feature,
            as permitted under those regulations.
          </P>
        </Section>

        <Section title="3. When we'll issue a refund">
          <List items={[
            "A technical fault on our side prevented the unlock from taking effect at all.",
            "You were charged more than once for the same unlock (duplicate transaction).",
            "The payment was unauthorised or fraudulent.",
          ]} />
          <P>Outside of these situations, refunds are considered case-by-case — contact us and explain what happened.</P>
        </Section>

        <Section title="4. How to request a refund">
          <P>
            Email us within 14 days of the charge with your Stripe receipt (or the email address used at checkout)
            and a short description of the issue.
          </P>
        </Section>

        <Section title="5. Donations">
          <P>Optional donations are voluntary contributions toward running costs and are non-refundable.</P>
        </Section>

        <Section title="6. Processing time">
          <P>Approved refunds are issued to your original payment method via Stripe and typically appear within 5–10 business days.</P>
        </Section>

        <Section title="7. Contact">
          <P>Refund requests: <a href="mailto:ionutpuescu23@gmail.com" className="underline" style={{ color: "#60A5FA" }}>ionutpuescu23@gmail.com</a></P>
        </Section>

        <p className="text-xs mt-10 pt-4" style={{ color: "#94A3B8", borderTop: "1px solid rgba(255,255,255,0.09)" }}>
          This page is provided for general informational purposes and does not constitute legal advice. Consider
          having it reviewed by a qualified solicitor to confirm it meets UK consumer protection requirements.
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold mb-2">{title}</h2>
      {children}
    </section>
  );
}

function P({ children }) {
  return <p className="text-sm leading-relaxed mb-3" style={{ color: "#CBD5E1" }}>{children}</p>;
}

function List({ items }) {
  return (
    <ul className="list-disc list-inside text-sm space-y-1.5 mb-3" style={{ color: "#CBD5E1" }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}
