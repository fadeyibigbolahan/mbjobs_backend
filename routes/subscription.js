// routes/subscription.js
const express = require("express");
const router = express.Router();
const stripe = require("../config/stripe");
const PricingPlan = require("../models/PricingPlan");
const User = require("../models/User");
const { userAuth } = require("../utils/Auth");

// routes/subscription.js - Even simpler approach
router.post("/create-checkout-session", userAuth, async (req, res) => {
  try {
    const { planId, periodId } = req.body;

    // Get the pricing plan
    const plan = await PricingPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    // Get the selected period
    const period = plan.subscriptionPeriods.find((p) => p.id === periodId);
    if (!period) {
      return res.status(400).json({ error: "Invalid subscription period" });
    }

    // Calculate price with discount
    const discountedPrice = plan.monthlyPrice * (1 - period.discount / 100);
    const totalPrice = Math.round(discountedPrice * period.months * 100); // Convert to cents

    // Create Stripe checkout session with simple line items
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${plan.title} Plan (${period.label})`,
              description: plan.description,
            },
            unit_amount: totalPrice,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/#/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/#/employer`,
      metadata: {
        userId: req.user._id.toString(),
        planId: planId,
        periodId: periodId,
      },
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// routes/subscription.js - additional routes
router.get("/current", userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "subscription.planId"
    );
    res.json({ subscription: user.subscription });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/cancel", userAuth, async (req, res) => {
  try {
    // Update user subscription to expired
    await User.findByIdAndUpdate(req.user._id, {
      "subscription.status": "expired",
    });

    res.json({ message: "Subscription cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
