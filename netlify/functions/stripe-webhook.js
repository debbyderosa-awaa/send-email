import Stripe from 'stripe';
import nodemailer from 'nodemailer';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Only handle successful payments
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    // Read custom field / metadata
    // Replace 'custom_answer' with the key you used in Stripe
    const customAnswer = session.metadata?.custom_answer || 'N/A';

    // Set up email transporter
    const transporter = nodemailer.createTransport({
      service: 'Gmail', // Or any email service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFY_EMAIL,
      subject: `New Payment Received: $${(session.amount_total / 100).toFixed(2)}`,
      text: `A payment was received.

Amount: $${(session.amount_total / 100).toFixed(2)}
Customer Email: ${session.customer_email || 'N/A'}
Payment ID: ${session.payment_intent || 'N/A'}
Custom Answer: ${customAnswer}`,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Email sent successfully.');
    } catch (emailErr) {
      console.error('Error sending email:', emailErr);
    }
  }

  return { statusCode: 200, body: 'Webhook received' };
}
