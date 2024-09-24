const express = require("express");
const cors = require("cors");
const stripe = require("stripe");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = 3001;

// Replace with your actual Stripe secret key
const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

const plans = {
  basic: {
    name: "Basic",
    monthlyPrice: 999, // $9.99
    annualPrice: 9590, // $95.90
    description: "Essential AI coaching for individuals",
  },
  pro: {
    name: "Pro",
    monthlyPrice: 2999, // $29.99
    annualPrice: 28790, // $287.90
    description: "Advanced coaching for professionals",
  },
  business: {
    name: "Business",
    monthlyPrice: 9999, // $99.99
    annualPrice: 95990, // $959.90
    description: "Comprehensive solution for teams",
  },
};

app.post("/create-checkout-session", async (req, res) => {
  const { plan, billingCycle } = req.body;

  if (!plans[plan]) {
    return res.status(400).json({ error: "Invalid plan selected" });
  }

  if (billingCycle !== "monthly" && billingCycle !== "annual") {
    return res.status(400).json({ error: "Invalid billing cycle" });
  }

  const selectedPlan = plans[plan];
  const price =
    billingCycle === "monthly"
      ? selectedPlan.monthlyPrice
      : selectedPlan.annualPrice;
  const interval = billingCycle === "monthly" ? "month" : "year";

  try {
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `AgentCoach.AI ${selectedPlan.name} Plan (${billingCycle})`,
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
      success_url: "http://localhost:3000/pricing?success=true",
      cancel_url: "http://localhost:3000/pricing?canceled=true",
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
