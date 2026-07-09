export const metadata = { title: "Privacy Policy — DIY vs PRO" };

export default function PrivacyPage() {
  return (
    <main style={{ background: "#0B0D10", color: "#F1F5F9", minHeight: "100vh" }} className="px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <a href="/" className="text-sm underline" style={{ color: "#60A5FA" }}>← Back to DIY vs PRO</a>
        <h1 className="text-2xl font-black uppercase tracking-wide mt-4">Privacy Policy</h1>
        <p className="text-xs mt-1 mb-8" style={{ color: "#94A3B8" }}>Last updated: 9 July 2026</p>

        <Section title="1. Overview">
          <P>
            DIY vs PRO doesn't use accounts, logins, or advertising trackers. This page explains what limited data
            we do handle, and why.
          </P>
        </Section>

        <Section title="2. What we collect">
          <List items={[
            "A random device identifier, stored in your browser's local storage and in our database — used only to track your free-use allowance and any one-time unlock purchases.",
            "Photos and/or text descriptions you submit for issue diagnosis, step-by-step guides, or Design Studio — sent to our AI providers to generate a response.",
            "Optional feedback you submit (ease-of-use rating, comments) — not linked to your device identifier.",
            "Payment details — handled entirely by Stripe. We never receive or store your card number.",
          ]} />
        </Section>

        <Section title="3. Third-party processors">
          <P>We rely on the following third parties to run the Service. Data you submit may be processed by them:</P>
          <List items={[
            "Anthropic (Claude API) — photo/description analysis, guide and design-spec generation.",
            "OpenAI — AI-generated images (fix visualisations, Design Studio renders).",
            "Pexels — stock reference photography for material/tool cards.",
            "Stripe — payment processing for unlocks and donations.",
            "Supabase (Postgres) — stores device access state and feedback.",
            "Vercel — application hosting.",
          ]} />
          <P>These providers may process data outside the UK/EEA. Each operates under its own privacy policy and terms.</P>
        </Section>

        <Section title="4. Cookies and local storage">
          <P>
            We don't use tracking or advertising cookies. We use your browser's local storage to hold a single
            random device identifier, which is essential to the free-trial/unlock feature working at all.
          </P>
        </Section>

        <Section title="5. Data retention">
          <P>
            Device access records are kept indefinitely to preserve your unlock status, unless you ask us to delete
            them (see below). Photos and descriptions you submit are passed to our AI providers to generate a
            response and are not separately archived by us beyond what's needed to serve that request.
          </P>
        </Section>

        <Section title="6. Your rights">
          <P>
            Under UK GDPR you can ask us to access, correct, or delete data linked to your device identifier.
            Because there's no account system, we can only act on requests that include your device identifier
            (copyable from the app's footer) or Stripe receipt. Contact us using the details below.
          </P>
        </Section>

        <Section title="7. Children">
          <P>The Service is not directed at, or knowingly used to collect data from, children under 18.</P>
        </Section>

        <Section title="8. Changes to this policy">
          <P>We may update this policy from time to time; the "last updated" date above will reflect the latest revision.</P>
        </Section>

        <Section title="9. Contact">
          <P>Questions or data requests: <a href="mailto:ionutpuescu23@gmail.com" className="underline" style={{ color: "#60A5FA" }}>ionutpuescu23@gmail.com</a></P>
        </Section>

        <p className="text-xs mt-10 pt-4" style={{ color: "#94A3B8", borderTop: "1px solid rgba(255,255,255,0.09)" }}>
          This page is provided for general informational purposes and does not constitute legal advice. Consider
          having it reviewed by a qualified solicitor to confirm it meets your legal obligations (including UK GDPR).
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
