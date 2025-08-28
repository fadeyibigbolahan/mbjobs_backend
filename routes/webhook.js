const express = require("express");
const router = express.Router();
const stripe = require("../config/stripe");
const User = require("../models/User");

router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;

        // Update user subscription
        const { userId, planId, periodId } = session.metadata;

        // Calculate end date based on period
        const endDate = new Date();
        if (periodId === "1month") endDate.setMonth(endDate.getMonth() + 1);
        else if (periodId === "3months")
          endDate.setMonth(endDate.getMonth() + 3);
        else if (periodId === "6months")
          endDate.setMonth(endDate.getMonth() + 6);
        else if (periodId === "1year")
          endDate.setFullYear(endDate.getFullYear() + 1);

        await User.findByIdAndUpdate(userId, {
          subscription: {
            planId,
            startDate: new Date(),
            endDate,
            status: "active",
          },
          stripeCustomerId: session.customer, // Save Stripe customer ID
        });

        console.log(`Subscription activated for user ${userId}`);
        break;

      case "invoice.payment_failed":
        // Handle payment failure
        const invoice = event.data.object;
        const customerId = invoice.customer;

        // Find user by stripeCustomerId and update subscription status
        await User.findOneAndUpdate(
          { stripeCustomerId: customerId },
          { "subscription.status": "expired" }
        );

        console.log(`Payment failed for customer ${customerId}`);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  }
);

module.exports = router;
