import nodemailer from "nodemailer";

const OWNER_EMAIL = "omaraqel270@gmail.com";

interface EmailProduct {
  name_ar: string;
  code: string;
  unit: string;
  price_jod: number;
}

interface SendLeadEmailParams {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  message?: string;
  products: EmailProduct[];
  totalJod: number;
}

export async function sendLeadEmail(params: SendLeadEmailParams): Promise<void> {
  const { customerName, customerPhone, customerEmail, message, products, totalJod } = params;

  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  if (!gmailAppPassword) {
    console.warn("⚠️ GMAIL_APP_PASSWORD is not set. Skipping lead email sending.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: OWNER_EMAIL,
      pass: gmailAppPassword,
    },
  });

  const lines = [
    "New customer lead",
    `Name:  ${customerName}`,
    `Phone: ${customerPhone || "—"}`,
    `Email: ${customerEmail || "—"}`,
    "",
    `Interested in (${products.length} product(s)):`,
  ];

  for (const p of products) {
    lines.push(
      `- ${p.name_ar} | كود: ${p.code} | الوحدة: ${p.unit} | السعر: ${p.price_jod} JOD`
    );
  }

  lines.push(
    "",
    `Total: ${totalJod.toFixed(2)} JOD`,
    "",
    `Message: ${message || "(none)"}`
  );

  const textContent = lines.join("\n");

  const mailOptions = {
    from: OWNER_EMAIL,
    to: OWNER_EMAIL,
    subject: `New customer lead - ${products.length} product(s) from ${customerName}`,
    text: textContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✉️ Lead email sent successfully to ${OWNER_EMAIL}`);
  } catch (error) {
    console.error("❌ Failed to send lead email:", error);
    throw error;
  }
}
