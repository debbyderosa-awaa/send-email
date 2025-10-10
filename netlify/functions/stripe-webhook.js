// netlify/functions/stripe-webhook.js

import Stripe from "stripe";
import sgMail from "@sendgrid/mail";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const sig = event.headers["stripe-signature"];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("⚠️ Webhook signature verification failed.", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;

    // ✅ Grab custom field (if you set one up in Checkout)
    const customAnswer = session.custom_fields?.[0]?.text?.value || "N/A";

    // ✅ Handle multiple recipients (comma separated in Netlify)
    const recipients = process.env.NOTIFY_EMAIL.split(",").map((e) => e.trim());

    const msg = {
      to: recipients, // supports multiple emails
      from: process.env.FROM_EMAIL, // must be verified in SendGrid
      subject: `💰 New Payment: $${(session.amount_total / 100).toFixed(2)}`,
      text: `A payment was received.

Amount: $${(session.amount_total / 100).toFixed(2)}
Customer Name: ${customerName}
Customer Email: ${session.customer_email || "N/A"}
`,
    };

    try {
      await sgMail.send(msg);
      console.log("✅ Email sent to:", recipients.join(", "));
    } catch (err) {
      console.error("❌ Error sending email:", err);
      return { statusCode: 500, body: "Error sending email" };
    }
  }

  return { statusCode: 200, body: "Webhook received" };
}
