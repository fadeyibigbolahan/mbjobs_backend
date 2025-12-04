const { Schema, model } = require("mongoose");

const PricingPlanSchema = new Schema({
  title: String,
  subtitle: String,

  monthlyPrice: Number,

  monthlyPrice: Number, // This is now your source of truth

  maxApprentices: Number,
  description: String,
  features: [String],
  popular: Boolean,

  icon: String, // store icon name so frontend can map to correct component

  color: String,
  bgColor: String,
  borderColor: String,
  buttonText: String,

  // stripePriceId removed - no longer needed

  subscriptionPeriods: [
    {
      id: String,
      label: String,
      months: Number,
      discount: Number,
    },
  ],
});

module.exports = model("PricingPlan", PricingPlanSchema);
