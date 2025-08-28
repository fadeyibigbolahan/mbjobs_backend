// config/subscriptionPlans.js
module.exports = {
  starter: {
    name: "Starter",
    features: {
      maxMembers: 10,
      canGenerateCards: false,
      accessAnalytics: false,
      customBranding: false,
    },
  },
  pro: {
    name: "Pro",
    features: {
      maxMembers: 100,
      canGenerateCards: true,
      accessAnalytics: true,
      customBranding: false,
    },
  },
  business: {
    name: "Business",
    features: {
      maxMembers: 500,
      canGenerateCards: true,
      accessAnalytics: true,
      customBranding: true,
    },
  },
  enterprise: {
    name: "Enterprise",
    features: {
      maxMembers: Infinity,
      canGenerateCards: true,
      accessAnalytics: true,
      customBranding: true,
    },
  },
};
