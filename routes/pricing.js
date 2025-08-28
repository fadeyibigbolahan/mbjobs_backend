// routes/pricing.js
const express = require("express");
const router = express.Router();
const PricingPlan = require("../models/PricingPlan");

router.get("/", async (req, res) => {
  try {
    const plans = await PricingPlan.find();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
