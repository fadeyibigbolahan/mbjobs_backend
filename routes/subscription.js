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

    // Create Stripe checkout session
    // In your create-checkout-session endpoint
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
      success_url: `http://localhost:5173/#/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:5173/#/employer`,
      metadata: {
        userId: req.user._id.toString(),
        planId: planId,
        periodId: periodId,
        planTitle: plan.title,
        periodLabel: period.label,
        months: period.months.toString(), // This is important for calculating endDate
      },
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Verify payment and activate subscription
router.get("/verify-payment/:sessionId", userAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    console.log("api called", sessionId);

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    // Verify the session belongs to the current user
    if (session.metadata.userId !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized access to session" });
    }

    // Check if payment was successful
    if (session.payment_status === "paid") {
      const plan = await PricingPlan.findById(session.metadata.planId);

      // Calculate expiration date based on period
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(
        startDate.getMonth() + parseInt(session.metadata.months)
      );

      // Update user subscription using YOUR existing User model structure
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        {
          $set: {
            "subscription.planId": session.metadata.planId,
            "subscription.startDate": startDate,
            "subscription.endDate": endDate,
            "subscription.status": "active",
            role: "employer", // Update role to employer
            approvalStatus: "approved", // Auto-approve since they paid
            approvalDate: new Date(),
          },
        },
        { new: true }
      ).select("-password"); // Exclude password from response

      return res.json({
        success: true,
        paid: true,
        user: {
          subscription: updatedUser.subscription,
          role: updatedUser.role,
          approvalStatus: updatedUser.approvalStatus,
        },
        message:
          "Subscription activated successfully! You are now an approved employer.",
      });
    }

    // Payment not completed
    res.json({
      success: false,
      paid: false,
      message: "Payment not completed",
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({
      success: false,
      error: "Payment verification failed",
    });
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
