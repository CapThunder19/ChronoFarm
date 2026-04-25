export const EVENTS: Record<
  number,
  {
    name: string;
    description: string;
    dialogue: string;
    effects: {
      priceMultiplier?: number;
      growthMultiplier?: number;
      demand?: string[]; // Crops that are in high demand
    };
  }
> = {
  1910: {
    name: "Peaceful Times",
    description: "The decade starts with relative stability in Europe.",
    dialogue: "Good morning, friend. The sun is shining, and the markets are steady. What have you brought me today?",
    effects: {
      priceMultiplier: 1.0,
    },
  },

  1914: {
    name: "World War I",
    description: "Food demand rises. Crop prices increase.",
    dialogue: "The front lines are hungry, farmer. The army needs everything you can grow. I'll pay top dollar for Wheat and Corn!",
    effects: {
      priceMultiplier: 1.5,
      demand: ["WHEAT", "CORN"],
    },
  },

  1918: {
    name: "Spanish Flu",
    description: "Workers are sick. Crops grow slower.",
    dialogue: "A terrible cough is going around. Half my porters are out. We'll take your harvest, but be careful out there.",
    effects: {
      growthMultiplier: 1.3,
    },
  },

  1923: {
    name: "Hyperinflation",
    description: "Money loses value rapidly. Prices fluctuate wildly.",
    dialogue: "Paper money is basically kindling now! I've had to update my prices three times this morning. Hurry up and sell!",
    effects: {
      priceMultiplier: 0.5,
    },
  },

  1929: {
    name: "Great Depression",
    description: "Market crash. Crop prices fall.",
    dialogue: "I've never seen anything like it. The banks are closed, and no one has a cent. I can only offer you pennies for these crops.",
    effects: {
      priceMultiplier: 0.3,
    },
  },

  1939: {
    name: "World War II",
    description: "Mass demand. Farming becomes critical.",
    dialogue: "War again... but this time, the scale is different. We need a massive stockpile. I'll take everything you have, at any price!",
    effects: {
      priceMultiplier: 2.5,
      demand: ["POTATO", "WHEAT", "CARROT"],
    },
  },
};