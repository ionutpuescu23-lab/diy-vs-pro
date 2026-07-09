export const metadata = { title: "Terms & Conditions — DIY vs PRO" };

export default function TermsPage() {
  return (
    <main style={{ background: "#0B0D10", color: "#F1F5F9", minHeight: "100vh" }} className="px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <a href="/" className="text-sm underline" style={{ color: "#60A5FA" }}>← Back to DIY vs PRO</a>
        <h1 className="text-2xl font-black uppercase tracking-wide mt-4">Terms &amp; Conditions</h1>
        <p className="text-xs mt-1 mb-8" style={{ color: "#94A3B8" }}>Last updated: 9 July 2026</p>

        <Section title="1. What this service is">
          <P>
            DIY vs PRO ("the Service") is a property-repair cost comparison and visual guide tool. It uses AI models
            to help identify property issues from a photo and/or description, estimate materials, labour, and tools
            costs, compare doing a job yourself against hiring a professional, and generate step-by-step fix plans
            and architectural concept designs.
          </P>
        </Section>

        <Section title="2. Not professional advice">
          <P>
            Every output from the Service — including issue diagnoses, cost estimates, fix plans, safety guidance,
            and Design Studio concepts — is an AI-generated estimate for general guidance only. It is not a
            substitute for a qualified tradesperson, surveyor, structural engineer, or building control inspection.
          </P>
          <P>
            You must always have gas, electrical (consumer unit/fixed wiring), structural, and other regulated work
            carried out and/or signed off by a suitably certified professional (e.g. Gas Safe, NICEIC/NAPIT,
            structural engineer), regardless of what the Service suggests is DIY-feasible.
          </P>
        </Section>

        <Section title="3. AI-generated content">
          <P>
            Diagnoses, cost figures, guides, and images are produced by third-party AI models (see our{" "}
            <a href="/privacy" className="underline" style={{ color: "#60A5FA" }}>Privacy Policy</a> for which
            providers). AI output can be inaccurate, incomplete, or unsuitable for your specific property. You are
            responsible for verifying anything before relying on it or acting on it.
          </P>
        </Section>

        <Section title="4. Payments and access">
          <P>
            The Service offers a limited number of free uses per device, after which continued use of the core
            features requires a one-time payment ("Unlock full access"). The AI Design Studio feature requires a
            separate one-time payment. Both are one-off purchases — there is no subscription or recurring charge.
          </P>
          <P>
            Payments are processed securely by Stripe. We never see or store your card details. See our{" "}
            <a href="/refund" className="underline" style={{ color: "#60A5FA" }}>Refund Policy</a> for cancellation
            and refund terms.
          </P>
          <P>
            Optional donations are voluntary contributions to support running costs and are non-refundable.
          </P>
        </Section>

        <Section title="5. Device-based access (no account/login)">
          <P>
            The Service does not require you to create an account. Instead, a random identifier is generated and
            stored in your browser to track free-use allowances and unlocked purchases. Clearing your browser data,
            switching browsers, or using a different device will be treated as a new, separate user.
          </P>
        </Section>

        <Section title="6. Acceptable use">
          <P>
            You agree not to attempt to circumvent the free-trial or payment system, interfere with the Service's
            operation, or use it to generate content for unlawful purposes.
          </P>
        </Section>

        <Section title="7. Intellectual property">
          <P>
            The Service's branding, design, and underlying software are owned by its operator. You retain all
            rights to photos you upload. AI-generated outputs are provided to you for your personal, non-commercial
            use in assessing your own property.
          </P>
        </Section>

        <Section title="8. Limitation of liability">
          <P>
            The Service is provided "as is" without warranty of any kind, express or implied, including as to the
            accuracy, completeness, or fitness for a particular purpose of any estimate, diagnosis, or generated
            content. To the maximum extent permitted by law, our liability for any claim relating to the Service is
            limited to the amount you paid to use it.
          </P>
        </Section>

        <Section title="9. Changes to these terms">
          <P>We may update these terms from time to time. Continued use of the Service after a change constitutes acceptance of the updated terms.</P>
        </Section>

        <Section title="10. Governing law">
          <P>These terms are governed by the laws of England and Wales.</P>
        </Section>

        <Section title="11. Contact">
          <P>Questions about these terms: <a href="mailto:ionutpuescu23@gmail.com" className="underline" style={{ color: "#60A5FA" }}>ionutpuescu23@gmail.com</a></P>
        </Section>

        <p className="text-xs mt-10 pt-4" style={{ color: "#94A3B8", borderTop: "1px solid rgba(255,255,255,0.09)" }}>
          This page is provided for general informational purposes and does not constitute legal advice. Consider
          having it reviewed by a qualified solicitor to confirm it meets your legal obligations.
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
