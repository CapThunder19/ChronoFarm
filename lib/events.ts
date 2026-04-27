export type HistoricalEvent = {
  name: string;
  description: string;
  dialogue: string;
  regions?: string[]; // Names of regions affected. If undefined, global.
  effects: {
    priceMultiplier?: number;
    growthMultiplier?: number;
    demand?: string[];
  };
};

export const EVENTS: Record<number, HistoricalEvent> = {
  1910: {
    name: "Peaceful Times",
    description: "The decade starts with relative stability across the globe.",
    dialogue: "Good morning, friend. The sun is shining, and the markets are steady. What have you brought me today?",
    effects: { priceMultiplier: 1.0 },
  },

  1912: {
    name: "The Titanic Era",
    description: "Luxury goods demand rises in the Americas.",
    dialogue: "The wealthy in New York are clamoring for the finest produce! Shipping to the Americas is looking very profitable right now.",
    regions: ["Americas"],
    effects: {
      priceMultiplier: 1.4,
      demand: ["POTATO", "WHEAT"],
    },
  },

  1914: {
    name: "World War I (Outbreak)",
    description: "Total war mobilization in Europe. Food is now a strategic resource.",
    dialogue: "The front lines are hungry, farmer. The army needs everything you can grow. I'll pay top dollar for Wheat and Corn!",
    regions: ["Europe"],
    effects: {
      priceMultiplier: 1.8,
      demand: ["WHEAT", "CORN"],
    },
  },

  1915: {
    name: "Asian Trade Boom",
    description: "Neutral markets in Asia see increased exports.",
    dialogue: "While Europe fights, Asia feeds! Our ports are busier than ever. We're looking for stable supplies of rice and grains.",
    regions: ["Asia"],
    effects: {
      priceMultiplier: 1.3,
      demand: ["WHEAT", "CORN"],
    },
  },

  1918: {
    name: "Spanish Flu Pandemic",
    description: "Global pandemic causes labor shortages. Growth is slower everywhere.",
    dialogue: "A terrible cough is going around. Half my porters are out. We'll take your harvest, but be careful out there.",
    effects: {
      growthMultiplier: 1.3,
    },
  },

  1920: {
    name: "The Roaring Twenties",
    description: "Economic boom in the Americas. Luxury crops in high demand.",
    dialogue: "Business is booming! Everyone wants a piece of the American dream. I'll take all the carrots and corn you can produce!",
    regions: ["Americas"],
    effects: {
      priceMultiplier: 1.5,
      demand: ["CORN", "CARROT"],
    },
  },

  1923: {
    name: "German Hyperinflation",
    description: "Economic collapse in Central Europe. Trade is difficult.",
    dialogue: "Paper money is basically kindling now! I've had to update my prices three times this morning. Sell while you can!",
    regions: ["Europe"],
    effects: {
      priceMultiplier: 0.2,
    },
  },

  1927: {
    name: "Canton Uprising",
    description: "Civil unrest in Asia disrupts agricultural logistics.",
    dialogue: "The roads to the interior are blocked by conflict. Bringing crops to market is a dangerous game these days.",
    regions: ["Asia"],
    effects: {
      priceMultiplier: 0.6,
      growthMultiplier: 1.5,
    },
  },

  1929: {
    name: "The Great Depression",
    description: "Global market crash. No one has money for food.",
    dialogue: "I've never seen anything like it. The banks are closed, and no one has a cent. I can only offer you pennies.",
    effects: {
      priceMultiplier: 0.3,
    },
  },

  1933: {
    name: "The Dust Bowl",
    description: "Severe drought in the Americas. Harvests are failing.",
    dialogue: "The sky is black with dust. Our fields are dry and blowing away. If you have anything to sell, it's worth its weight in gold.",
    regions: ["Americas"],
    effects: {
      growthMultiplier: 2.0,
      priceMultiplier: 2.0,
    },
  },

  1937: {
    name: "Sino-Japanese War",
    description: "Escalation in Asia leads to massive military demand.",
    dialogue: "The military requisition officers are everywhere. They're seizing stockpiles. If you want to sell, do it quietly and quickly.",
    regions: ["Asia"],
    effects: {
      priceMultiplier: 1.7,
      demand: ["WHEAT", "POTATO"],
    },
  },

  1939: {
    name: "World War II (Global Conflict)",
    description: "Total global mobilization. Farming is now the highest priority.",
    dialogue: "War again... but this time, the scale is different. We need a massive stockpile for the years ahead.",
    effects: {
      priceMultiplier: 2.5,
      demand: ["POTATO", "WHEAT", "CARROT", "CORN"],
    },
  },
};