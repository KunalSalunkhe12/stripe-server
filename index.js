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
    monthlyPrice: 1995, // $19.95
    annualPrice: 17955, // $179.55
    description: "Advanced coaching for professionals",
  },
  team: {
    name: "Team",
    monthlyPrice: 3995, // $39.95
    annualPrice: 35955, // $359.55
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

app.post("/create-customer-portal-session", async (req, res) => {
  try {
    // In a real application, you would get the customer ID from the authenticated session
    const { email } = req.body;
    const customerPayment = await Payment.findOne({ userEmail: email });

    if (!customerPayment) {
      return res.status(400).json({ error: "Customer not found" });
    }
    const session = await stripeClient.billingPortal.sessions.create({
      customer: customerPayment.customerId,
      return_url: `${process.env.FRONTEND_URL}/`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating portal session:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Stripe webhook route
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // Add this to your .env file
    console.log("webhook triggered");
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    console.log("webhook type",event.type);
    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
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
            currentPeriodEnd: subscription.current_period_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          });

          const payment = await newPayment.save();
          console.log("Payment record created:", payment);
          await updateClerkUser(payment);
        } catch (error) {
          console.error("Error processing checkout.session.completed:", error);
        }
        break;

      case "customer.subscription.updated":
        const subscription = event.data.object;
        console.log("Subscription updated:", subscription);
        try {
          // Find the payment record associated with this subscription
          const payment = await Payment.findOne({
            subscriptionId: subscription.id,
          });

          if (payment) {
            payment.status = subscription.status;
            payment.currentPeriodEnd = subscription.current_period_end;
            payment.cancelAtPeriodEnd = subscription.cancel_at_period_end;

            await payment.save();
            await updateClerkUser(payment);
          } else {
            console.log(
              "No payment record found for canceled subscription:",
              deletedSubscription.id
            );
          }
        } catch (error) {
          console.error(
            "Error processing customer.subscription.deleted:",
            error
          );
        }
        break;
      case "customer.subscription.deleted":
        const deletedSubscription = event.data.object;
        try {
          // Find the payment record associated with this subscription
          const payment = await Payment.findOne({
            subscriptionId: deletedSubscription.id,
          });

          if (payment) {
            await updateClerkUser({
              userEmail: payment.userEmail,
              tier: "free",
            });
            await Payment.deleteOne({ subscriptionId: deletedSubscription.id });
          } else {
            console.log(
              "No payment record found for canceled subscription:",
              deletedSubscription.id
            );
          }
        } catch (error) {
          console.error(
            "Error processing customer.subscription.deleted:",
            error
          );
        }
      default:
        console.log(`Unhandled event type ${event.type}`);
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
