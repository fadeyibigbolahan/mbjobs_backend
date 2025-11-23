// routes/subscription.js
const express = require("express");
const router = express.Router();
const stripe = require("../config/stripe");
const PricingPlan = require("../models/PricingPlan");
const User = require("../models/User");
const { userAuth } = require("../utils/Auth");

// Create checkout session for new subscription
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

    // Calculate price with discount - ensure it's not zero
    const discountedPrice = plan.monthlyPrice * (1 - period.discount / 100);
    const totalPrice = Math.round(discountedPrice * period.months * 100); // Convert to cents

    // Validate that the price is above Stripe's minimum
    if (totalPrice < 50) {
      // Stripe minimum is $0.50 (50 cents)
      return res.status(400).json({
        error:
          "The selected plan amount is below the minimum required amount. Please choose a different plan or period.",
      });
    }

    console.log("Checkout session details:", {
      plan: plan.title,
      period: period.label,
      monthlyPrice: plan.monthlyPrice,
      discount: period.discount,
      discountedPrice,
      totalPriceCents: totalPrice,
      totalPriceDollars: totalPrice / 100,
    });

    // Create Stripe checkout session
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
            unit_amount: totalPrice, // Amount in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `https://virtualkonektions.com/#/payment-success?session_id={CHECKOUT_SESSION_ID}&type=new`,
      cancel_url: `https://virtualkonektions.com/#/dashboard/user-profile`,
      metadata: {
        userId: req.user._id.toString(),
        planId: planId,
        periodId: periodId,
        planTitle: plan.title,
        periodLabel: period.label,
        months: period.months.toString(),
        totalPrice: totalPrice.toString(),
        type: "new",
      },
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);

    if (error.type === "StripeInvalidRequestError") {
      return res.status(400).json({
        error:
          "Payment configuration error. Please try a different subscription period or contact support.",
      });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/renew-subscription", userAuth, async (req, res) => {
  try {
    const { planId, periodId } = req.body;

    // Get current user and check if they have an existing subscription
    const user = await User.findById(req.user._id);
    if (!user || user.role !== "employer") {
      return res
        .status(403)
        .json({ error: "Only employers can renew subscriptions" });
    }

    // Check if user has an existing subscription
    if (!user.subscription || !user.subscription.planId) {
      return res
        .status(400)
        .json({ error: "No existing subscription found to renew" });
    }

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

    // Calculate price with discount - ensure it's not zero
    const discountedPrice = plan.monthlyPrice * (1 - period.discount / 100);
    const totalPrice = Math.round(discountedPrice * period.months * 100); // Convert to cents

    // Validate that the price is above Stripe's minimum
    if (totalPrice < 50) {
      // Stripe minimum is $0.50 (50 cents)
      return res.status(400).json({
        error:
          "The selected plan amount is below the minimum required amount. Please choose a different plan or period.",
      });
    }

    console.log("Renewal details:", {
      plan: plan.title,
      period: period.label,
      monthlyPrice: plan.monthlyPrice,
      discount: period.discount,
      discountedPrice,
      totalPriceCents: totalPrice,
      totalPriceDollars: totalPrice / 100,
    });

    // Create Stripe checkout session for renewal
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${plan.title} Plan Renewal (${period.label})`,
              description: `Renew your subscription - ${plan.description}`,
            },
            unit_amount: totalPrice, // Amount in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `https://virtualkonektions.com/#/payment-success?session_id={CHECKOUT_SESSION_ID}&type=renewal`,
      // success_url: `http://localhost:5173/#/payment-success?session_id={CHECKOUT_SESSION_ID}&type=renewal`,
      cancel_url: `https://virtualkonektions.com/#/dashboard/user-profile`,
      metadata: {
        userId: req.user._id.toString(),
        planId: planId,
        periodId: periodId,
        planTitle: plan.title,
        periodLabel: period.label,
        months: period.months.toString(),
        totalPrice: totalPrice.toString(),
        type: "renewal", // Indicates this is a renewal
        previousPlanId: user.subscription.planId.toString(), // Track previous plan
      },
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error("Error creating renewal session:", error);

    // Provide more specific error messages
    if (error.type === "StripeInvalidRequestError") {
      return res.status(400).json({
        error:
          "Payment configuration error. Please try a different subscription period or contact support.",
      });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// Verify payment and activate/renew subscription
router.get("/verify-payment/:sessionId", userAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { type } = req.query; // 'new' or 'renewal'

    console.log("api called", sessionId, "type:", type);

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
      const user = await User.findById(req.user._id);

      // Calculate expiration date based on period
      const startDate = new Date();
      let endDate = new Date();

      // For renewals, extend from current end date if subscription is still active
      if (
        type === "renewal" &&
        user.subscription &&
        user.subscription.endDate
      ) {
        const currentEndDate = new Date(user.subscription.endDate);
        const now = new Date();

        // If subscription hasn't expired yet, extend from current end date
        // Otherwise, start from now
        if (currentEndDate > now) {
          startDate.setTime(currentEndDate.getTime()); // Start from current end date
          endDate.setTime(currentEndDate.getTime());
        }
      }

      endDate.setMonth(
        startDate.getMonth() + parseInt(session.metadata.months)
      );

      // Update user subscription
      const updateData = {
        $set: {
          subscription: {
            planId: session.metadata.planId,
            startDate:
              type === "renewal" && user.subscription
                ? user.subscription.startDate
                : startDate,
            endDate: endDate,
            status: "active",
            planTitle: session.metadata.planTitle,
            periodLabel: session.metadata.periodLabel,
            totalPaid: parseInt(session.metadata.totalPrice) / 100,
            autoRenew: true,
          },
          role: "employer",
          approvalStatus: "approved",
          approvalDate: new Date(),
        },
      };

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        updateData,
        { new: true, runValidators: true }
      ).select("-password");

      const message =
        type === "renewal"
          ? "Subscription renewed successfully! Your subscription has been extended."
          : "Subscription activated successfully! You are now an approved employer.";

      return res.json({
        success: true,
        paid: true,
        type: type || "new",
        user: {
          subscription: updatedUser.subscription,
          role: updatedUser.role,
          approvalStatus: updatedUser.approvalStatus,
        },
        message: message,
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

// Get current subscription with real-time expiration status
router.get("/current", userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "subscription.planId"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Use the instance method to check real-time expiration
    const isExpired = user.isSubscriptionExpired();

    // Return subscription with real-time status
    const subscriptionData = {
      ...user.subscription.toObject(),
      isActuallyExpired: isExpired,
      effectiveStatus: isExpired
        ? "expired"
        : user.subscription.status || "inactive",
    };

    res.json({
      subscription: subscriptionData,
      // Include user role for frontend checks
      userRole: user.role,
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Cancel subscription
router.post("/cancel", userAuth, async (req, res) => {
  try {
    // Update user subscription to expired - the pre-save middleware will handle this correctly
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "subscription.status": "expired",
          "subscription.autoRenew": false,
        },
      },
      { new: true, runValidators: true }
    );

    res.json({
      message: "Subscription cancelled successfully",
      subscription: updatedUser.subscription,
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Enable auto-renewal
router.post("/enable-auto-renew", userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || !user.subscription) {
      return res.status(400).json({ error: "No active subscription found" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "subscription.autoRenew": true,
        },
      },
      { new: true, runValidators: true }
    );

    res.json({
      message: "Auto-renewal enabled successfully",
      subscription: updatedUser.subscription,
    });
  } catch (error) {
    console.error("Error enabling auto-renewal:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Disable auto-renewal
router.post("/disable-auto-renew", userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || !user.subscription) {
      return res.status(400).json({ error: "No active subscription found" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "subscription.autoRenew": false,
        },
      },
      { new: true, runValidators: true }
    );

    res.json({
      message: "Auto-renewal disabled successfully",
      subscription: updatedUser.subscription,
    });
  } catch (error) {
    console.error("Error disabling auto-renewal:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get subscription renewal options
router.get("/renewal-options", userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || user.role !== "employer") {
      return res
        .status(403)
        .json({ error: "Only employers can view renewal options" });
    }

    // Get all available plans for renewal
    const plans = await PricingPlan.find({ isActive: true });

    // Get current subscription info
    const currentSubscription = user.subscription || {};
    const isExpired = user.isSubscriptionExpired();

    res.json({
      currentSubscription: {
        ...currentSubscription,
        isExpired,
        canRenew: isExpired || currentSubscription.status === "active",
      },
      availablePlans: plans,
      message: isExpired
        ? "Your subscription has expired. Please renew to continue using employer features."
        : "Your subscription is active. You can renew to extend your subscription period.",
    });
  } catch (error) {
    console.error("Error fetching renewal options:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Additional endpoint to check subscription status (useful for frontend)
router.get("/status", userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || user.role !== "employer") {
      return res.json({
        hasSubscription: false,
        status: "inactive",
        message: "User is not an employer or has no subscription",
      });
    }

    const isExpired = user.isSubscriptionExpired();
    const hasActiveSubscription =
      user.subscription && user.subscription.status === "active" && !isExpired;

    res.json({
      hasSubscription: !!user.subscription,
      hasActiveSubscription,
      status: hasActiveSubscription
        ? "active"
        : isExpired
        ? "expired"
        : "inactive",
      isExpired,
      canRenew: !!user.subscription, // Can renew if they have any subscription history
      autoRenew: user.subscription?.autoRenew || false,
      subscription: user.subscription || null,
    });
  } catch (error) {
    console.error("Error checking subscription status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
