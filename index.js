const express = require("express");
const cors = require("cors");
const stripe = require("stripe");
const dotenv = require("dotenv");
const dbConnect = require("./db/connectDB");
const Payment = require("./db/payment.model");
const updateClerkUser = require("./utils/updateClerkUser");

dotenv.config();

const app = express();
const port = 3001;

// Replace with your actual Stripe secret key
const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());

app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

const plans = {
  individual: {
    name: "Individual",
    monthlyPrice: 2995, // $29.95
    annualPrice: 28500, // $285
    description: "Advanced coaching for professionals",
  },
  team: {
    name: "Team",
    monthlyPrice: 4995, // $49.95
    annualPrice: 44500, // $445
    description: "Comprehensive solution for teams",
  },
};

app.get("/payments", async (req, res) => {
  try {
    const payments = await Payment.find({});
    res.json(payments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

app.get("/payments/:email", async (req, res) => {
  const { email } = req.params;

  try {
    const paymentInfo = await Payment.find({ userEmail: email });
    res.json(paymentInfo);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

app.post("/create-checkout-session", async (req, res) => {
  const { plan, billingPeriod, clerkEmail, clerkUserId } = req.body;

  console.log("plan", plan);
  console.log("billingCycle", billingPeriod);

  if (!plans[plan]) {
    return res.status(400).json({ error: "Invalid plan selected" });
  }

  if (billingPeriod !== "monthly" && billingPeriod !== "annual") {
    return res.status(400).json({ error: "Invalid billing cycle" });
  }

  const selectedPlan = plans[plan];
  const price =
    billingPeriod === "monthly"
      ? selectedPlan.monthlyPrice
      : selectedPlan.annualPrice;
  const interval = billingPeriod === "monthly" ? "month" : "year";

  try {
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${selectedPlan.name}`,
              description: selectedPlan.description,
            },
            recurring: {
              interval: interval,
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.FRONTEND_URL}/`,
      cancel_url: `${process.env.FRONTEND_URL}/`,
      metadata: {
        clerkEmail: clerkEmail,
        clerkUserId: clerkUserId,
        planName: selectedPlan.name,
        planDescription: selectedPlan.description,
        monthlyPrice: selectedPlan.monthlyPrice.toString(),
        annualPrice: selectedPlan.annualPrice.toString(),
        selectedBillingPeriod: billingPeriod,
        selectedPrice: price.toString(),
      },
      customer_email: clerkEmail,
      billing_address_collection: "auto",
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// New route to cancel a subscription
app.post("/cancel-subscription", async (req, res) => {
  const { subscriptionId } = req.body;

  if (!subscriptionId) {
    return res.status(400).json({ error: "Subscription ID is required" });
  }

  try {
    const subscription = await stripeClient.subscriptions.update(
      subscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    console.log("Subscription scheduled for cancellation:", subscription.id);

    // TODO: Update user's subscription status in your database to reflect pending cancellation

    res.json({
      message:
        "Subscription scheduled for cancellation at the end of the billing period",
      cancellationDate: new Date(subscription.cancel_at * 1000).toISOString(),
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

// Stripe webhook route
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // Add this to your .env file

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      try {
        // Retrieve the subscription details
        const subscription = await stripeClient.subscriptions.retrieve(
          session.subscription
        );

        // Retrieve the customer details
        const customer = await stripeClient.customers.retrieve(
          session.customer
        );

        // Retrieve the product details
        const product = await stripeClient.products.retrieve(
          subscription.plan.product
        );

        // Create a new payment record
        const newPayment = new Payment({
          userEmail: customer.email,
          tier: product.name.toLowerCase(),
          customerId: customer.id,
          subscriptionId: subscription.id,
          planDetails: {
            name: product.name,
            description: product.description,
            billingPeriod: subscription.plan.interval,
            price: subscription.plan.amount,
          },
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        });

        await newPayment.save();
        await updateClerkUser(newPayment);
        console.log("Payment record created:", newPayment);
      } catch (error) {
        console.error("Error processing checkout.session.completed:", error);
      }
    }
    // Return a response to acknowledge receipt of the event
    res.json({ received: true });
  }
);

async function start() {
  await dbConnect();

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

start();
