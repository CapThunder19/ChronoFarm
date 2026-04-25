export const EVENTS: Record<
  number,
  {
    name: string;
    description: string;
    effects: {
      priceMultiplier?: number;
      growthMultiplier?: number;
    };
  }
> = {
  1914: {
    name: "World War I",
    description:
      "Food demand rises. Crop prices increase.",
    effects: {
      priceMultiplier: 1.5,
    },
  },

  1918: {
    name: "Spanish Flu",
    description:
      "Workers are sick. Crops grow slower.",
    effects: {
      growthMultiplier: 1.3,
    },
  },

  1929: {
    name: "Great Depression",
    description:
      "Market crash. Crop prices fall.",
    effects: {
      priceMultiplier: 0.7,
    },
  },

  1939: {
    name: "World War II",
    description:
      "Mass demand. Farming becomes critical.",
    effects: {
      priceMultiplier: 2,
    },
  },
};