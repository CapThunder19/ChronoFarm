export const CROPS: Record<
  string,
  { name: string; emoji: string; growTime: number; reward: number; regions?: string[]; unlockLevel?: number }
> = {
  WHEAT: {
    name: "Wheat",
    emoji: "🌾",
    growTime: 10000,
    reward: 10,
    // Widely grown grain
    regions: ["Europe", "Americas", "Asia"],
    unlockLevel: 1,
  },

  POTATO: {
    name: "Potato",
    emoji: "🥔",
    growTime: 20000,
    reward: 20,
    regions: ["Europe", "Americas"],
    unlockLevel: 1,
  },

  CARROT: {
    name: "Carrot",
    emoji: "🥕",
    growTime: 5000,
    reward: 5,
    regions: ["Americas", "Europe"],
    unlockLevel: 1,
  },

  CORN: {
    name: "Corn",
    emoji: "🌽",
    growTime: 30000,
    reward: 30,
    regions: ["Americas", "Asia"],
    unlockLevel: 1,
  },
  
  RICE: {
    name: "Rice",
    emoji: "🍚",
    growTime: 18000,
    reward: 18,
    regions: ["Asia"],
    unlockLevel: 4,
  },

  TOMATO: {
    name: "Tomato",
    emoji: "🍅",
    growTime: 8000,
    reward: 12,
    regions: ["Europe", "Americas"],
    unlockLevel: 2,
  },

  APPLE: {
    name: "Apple",
    emoji: "🍎",
    growTime: 45000,
    reward: 40,
    regions: ["Europe"],
    unlockLevel: 3,
  },

  GRAPE: {
    name: "Grape",
    emoji: "🍇",
    growTime: 40000,
    reward: 38,
    regions: ["Europe"],
    unlockLevel: 5,
  },

  SUGARCANE: {
    name: "Sugarcane",
    emoji: "🎋",
    growTime: 35000,
    reward: 35,
    regions: ["Americas", "Asia"],
    unlockLevel: 3,
  },

  TEA: {
    name: "Tea",
    emoji: "🍵",
    growTime: 25000,
    reward: 25,
    regions: ["Asia"],
    unlockLevel: 3,
  },

  SOYBEAN: {
    name: "Soybean",
    emoji: "🌱",
    growTime: 22000,
    reward: 22,
    regions: ["Americas", "Asia"],
    unlockLevel: 2,
  },
};