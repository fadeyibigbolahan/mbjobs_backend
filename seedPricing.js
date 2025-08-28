// seedPricing.js
const mongoose = require("mongoose");
const PricingPlan = require("./models/PricingPlan");

// ✅ Replace with your real MongoDB connection string
const MONGO_URI =
  "mongodb+srv://kingwaretech:newSeason26@cluster0.pnnrfrh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Your subscription periods
const subscriptionPeriods = [
  { id: "1month", label: "1 Month", months: 1, discount: 0 },
  { id: "3months", label: "3 Months", months: 3, discount: 10 },
  { id: "6months", label: "6 Months", months: 6, discount: 15 },
  { id: "1year", label: "1 Year", months: 12, discount: 25 },
];

// Your pricing plans
const basePricingPlans = [
  {
    title: "Free",
    subtitle: "Explore & Prepare",
    monthlyPrice: 0,
    maxApprentices: 1,
    description:
      "Perfect for new training centers, small clinics, or first-time employers exploring apprenticeships",
    features: [
      "1 Apprentice Resume Match per Month",
      "Community Q&A Support with AI assistance",
      "Employer Resource Toolkit (PDF only)",
      "Apprenticeship Readiness Checklist",
      "Free Profile Setup for Candidates",
      "Access to Scam-Free Platform (Verified Employers Only)",
      "Candidate Profiles + Resume Upload",
      "Job Posting System (Limited to 1 Active Listing)",
      "Basic fraud prevention + posting review",
    ],
    popular: false,
    icon: "Users",
    color: "from-gray-500 to-gray-600",
    bgColor: "from-gray-50 to-gray-100",
    borderColor: "border-gray-200",
    buttonText: "Start Free",

    stripePriceId: "price_free_plan", // You'll need to create this in Stripe
  },
  {
    title: "Standard",
    subtitle: "Grow & Match",
    monthlyPrice: 497,
    maxApprentices: 5,
    description:
      "Growing clinics, multi-location practices, or training providers scaling apprenticeships",
    features: [
      "5 Apprentice Matches per Month",
      "AI-Powered Resume-to-Training Matching",
      "Priority Email + Chat Support",
      "Full Employer Dashboard & Onboarding Portal",
      "Analytics Dashboard for Apprentice Progress",
      "Pre-Built RTI Curriculum (Customer Service & MBAC)",
      "Resume & Portfolio Uploads",
      "Training & Certification Access",
      "Background Check Options for Candidates",
      "Enhanced job posting capabilities (FT, PT, contract, gig)",
      "Secure in-app messaging system",
      "Flexible job types supported (W-2 & 1099)",
    ],
    popular: true,
    icon: "Zap",
    color: "from-violet-500 to-purple-600",
    bgColor: "from-violet-50 to-purple-100",
    borderColor: "border-violet-300",
    buttonText: "Get Matched",

    stripePriceId: "price_standard_plan", // You'll need to create this in Stripe
  },
  {
    title: "Premium",
    subtitle: "Scale & Succeed",
    monthlyPrice: 697,
    maxApprentices: 10,
    description:
      "Workforce boards, multi-site organizations, large training providers, and state-funded programs",
    features: [
      "10 Apprentice Placements",
      "Everything in Standard Tier",
      "AI-Powered Employer-to-Candidate Matching",
      "Dedicated Partnership Manager",
      "Advanced Reporting & Analytics Dashboard",
      "24/7 Priority Support",
      "Custom CRM + API Integrations",
      "Verified Employer Badge + Premium Listing Placement",
      "Access to Premium Training Courses & Certifications",
      "Custom Branding for Job Posts & Flyers",
      "Candidate Mentorship Network Access",
      "White-Labeled Employer Training Dashboard",
      "Premium Job Matching for Freelancers & Contractors",
      "Pre-Filled OJT Agreements + WIOA Tracking Toolkit",
      "Quarterly Strategy Calls + Employer Webinars",
      "Scam Detection AI Layer + Escrow Payment Option",
    ],
    popular: false,
    icon: "Crown",
    color: "from-amber-500 to-orange-600",
    bgColor: "from-amber-50 to-orange-100",
    borderColor: "border-amber-300",
    buttonText: "Join the Movement",

    stripePriceId: "price_premium_plan", // You'll need to create this in Stripe
  },
];

// Function to seed data
async function seedPricingPlans() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    // Clear old pricing plans
    await PricingPlan.deleteMany({});
    console.log("🗑 Old pricing plans deleted");

    // Add subscription periods to each plan
    const plansWithPeriods = basePricingPlans.map((plan) => ({
      ...plan,
      subscriptionPeriods,
    }));

    // Insert new plans
    const savedPlans = await PricingPlan.insertMany(plansWithPeriods);
    console.log(`✅ Inserted ${savedPlans.length} pricing plans`);

    process.exit();
  } catch (error) {
    console.error("❌ Error seeding pricing plans:", error);
    process.exit(1);
  }
}

seedPricingPlans();
