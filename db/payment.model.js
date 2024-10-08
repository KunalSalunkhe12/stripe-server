const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  userEmail: {
    type: String,
    unique: true,
    required: [true, "Please provide a user email"],
    maxlength: [100, "Email cannot be more than 100 characters"],
  },
  tier: {
    type: String,
    required: [true, "Please specify the tier"],
    enum: ["free", "individual", "team", "organization"],
  },
  customerId: {
    type: String,
    required: [true, "Please provide a Customer"],
  },
  subscriptionId: {
    type: String,
    required: [true, "Please provide a Subscription ID"],
    unique: true,
  },
  planDetails: {
    name: {
      type: String,
      required: [true, "Please provide the plan name"],
    },
    description: {
      type: String,
      required: [true, "Please provide the plan description"],
    },
    billingPeriod: {
      type: String,
      required: [true, "Please specify the billing period"],
    },
    price: {
      type: Number,
      required: [true, "Please provide the plan price"],
    },
  },
  status: {
    type: String,
    required: [true, "Please provide the subscription status"],
    enum: [
      "active",
      "past_due",
      "unpaid",
      "canceled",
      "incomplete",
      "incomplete_expired",
      "trialing",
    ],
  },
  currentPeriodEnd: {
    type: Date,
    required: [true, "Please provide the current period end date"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false,
  },
});

module.exports =
  mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
