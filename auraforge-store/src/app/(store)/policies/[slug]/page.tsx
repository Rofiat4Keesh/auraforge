import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { company, policyPages, shippingConfig } from "@/lib/store-config";
import { formatMoney } from "@/lib/money";

/**
 * Starter policy pages. Review the wording with your legal adviser before launch and
 * edit the text below to match how AuraForge actually operates.
 */

interface Section {
  heading: string;
  body: string[];
}

function policyContent(slug: string): Section[] | null {
  const name = company.legalName;
  switch (slug) {
    case "terms":
      return [
        {
          heading: "About us",
          body: [
            `This website is operated by ${name}, a company registered in Nigeria with RC No: ${company.rcNumber}. By placing an order you agree to these terms.`,
          ],
        },
        {
          heading: "Prices and payment",
          body: [
            "All prices are shown in Nigerian Naira (₦) and include VAT where applicable.",
            "Payments are processed securely by Paystack. We never see or store your full card details.",
            "An order is confirmed only after Paystack confirms successful payment.",
          ],
        },
        {
          heading: "Availability",
          body: [
            "Stock levels are updated in real time but may occasionally be inaccurate. If an item becomes unavailable after you pay, we will contact you to offer an alternative or a full refund.",
          ],
        },
        {
          heading: "Software and digital products",
          body: [
            "Licence keys are delivered to the email address provided at checkout and are subject to the software publisher's licence terms. Activated licence keys cannot be returned.",
          ],
        },
        { heading: "Contact", body: [`Questions about these terms can be sent to ${company.supportEmail}.`] },
      ];
    case "privacy":
      return [
        {
          heading: "Who we are",
          body: [
            `${name} (RC No: ${company.rcNumber}) is the data controller for personal data collected on this website.`,
          ],
        },
        {
          heading: "What we collect",
          body: [
            "Your name, email address, phone number and delivery address when you place an order or create an account.",
            "Payment information is collected directly by Paystack; we receive only a transaction reference and status.",
          ],
        },
        {
          heading: "How we use it",
          body: [
            "To process and deliver orders, provide customer support and warranty service, and meet legal and accounting obligations. We do not sell your personal data.",
          ],
        },
        {
          heading: "Your rights",
          body: [
            "In line with the Nigeria Data Protection Act 2023 you may request access to, correction of, or deletion of your personal data.",
            `Contact ${company.supportEmail} to exercise these rights.`,
          ],
        },
        {
          heading: "Cookies",
          body: ["We use essential cookies only: one to keep your cart and one to keep you signed in."],
        },
      ];
    case "returns":
      return [
        {
          heading: "7-day returns",
          body: [
            "Unused items in their original, sealed packaging may be returned within 7 days of delivery for a refund or exchange.",
          ],
        },
        {
          heading: "Faulty items",
          body: [
            "If an item is faulty on arrival, contact us within 48 hours. We will repair, replace or refund it after inspection by our technicians.",
          ],
        },
        {
          heading: "Warranty and repairs",
          body: [
            "Products carry the warranty period shown on their product page. Warranty claims are handled at our service centre; proof of purchase (your order reference) is required.",
            "Damage caused by misuse, liquid, power surges or unauthorised repairs is not covered, but our repair service can quote to fix it.",
          ],
        },
        {
          heading: "Refunds",
          body: [
            "Approved refunds are paid back to the original payment method through Paystack, usually within 5–10 working days.",
          ],
        },
      ];
    case "shipping":
      return [
        { heading: "Where we deliver", body: ["We deliver to all 36 states and the Federal Capital Territory."] },
        {
          heading: "Delivery fees",
          body: [
            `A flat delivery fee of ${formatMoney(shippingConfig.flatFeeKobo)} applies to orders below ${formatMoney(shippingConfig.freeThresholdKobo)}. Orders at or above ${formatMoney(shippingConfig.freeThresholdKobo)} ship free.`,
          ],
        },
        {
          heading: "Delivery times",
          body: [
            "Lagos: 1–2 working days. Other states: 2–5 working days. Digital products are delivered by email immediately after payment is confirmed.",
          ],
        },
        {
          heading: "On delivery",
          body: [
            "Our courier will call the phone number provided before arriving. Please inspect the package and report visible damage before signing.",
          ],
        },
      ];
    default:
      return null;
  }
}

interface PolicyPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PolicyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = policyPages.find((p) => p.slug === slug);
  return { title: page?.title ?? "Policy" };
}

export default async function PolicyPage({ params }: PolicyPageProps) {
  const { slug } = await params;
  const page = policyPages.find((p) => p.slug === slug);
  const sections = policyContent(slug);
  if (!page || !sections) notFound();

  return (
    <div className="container-x max-w-3xl py-12">
      <p className="eyebrow">Policies</p>
      <h1 className="mt-2 text-3xl font-bold">{page.title}</h1>
      <p className="mt-2 text-sm text-ink-500">
        {company.legalName} · RC No: {company.rcNumber}
      </p>
      <div className="mt-10 space-y-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold text-neon-cyan">{section.heading}</h2>
            <div className="mt-3 space-y-3 leading-relaxed text-ink-300">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
