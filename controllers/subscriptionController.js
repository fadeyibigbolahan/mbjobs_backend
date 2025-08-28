const stripe = require("../config/stripe");
const PricingPlan = require("../models/PricingPlan");
const User = require("../models/User");

exports.createCheckoutSession = async (req, res) => {
  try {
    const { planId, periodId } = req.body; // planId from DB, period (1 month, 3 months, etc.)
    const user = await User.findById(req.user._id);

    if (!user || user.role !== "employer") {
      return res.status(403).json({ message: "Only employers can subscribe" });
    }

    const plan = await PricingPlan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    // Find chosen period
    const period = plan.subscriptionPeriods.find((p) => p.id === periodId);
    if (!period)
      return res.status(400).json({ message: "Invalid subscription period" });

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          price: plan.stripePriceId, // price ID in Stripe
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
      metadata: {
        userId: user._id.toString(),
        planId: plan._id.toString(),
        periodId,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create checkout session" });
  }
};
