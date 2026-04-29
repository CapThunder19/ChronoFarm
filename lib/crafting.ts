export type Ingredient = {
  type: string;
  amount: number;
};

export type CraftingRecipe = {
  id: string;
  name: string;
  description: string;
  ingredients: Ingredient[];
  output: Ingredient;
  craftTime: number; // in milliseconds
  buffDescription: string;
};

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: "WOODEN_GEAR",
    name: "Wooden Gear",
    description: "A basic gear made of wood. Used for simple machinery.",
    ingredients: [{ type: "WOOD", amount: 5 }],
    output: { type: "WOODEN_GEAR", amount: 1 },
    craftTime: 5000,
    buffDescription: "Used to craft higher tier machinery.",
  },
  {
    id: "FERTILIZER",
    name: "Fertilizer",
    description: "A rich mix of organic material that speeds up crop growth.",
    ingredients: [
      { type: "WOOD", amount: 2 },
      { type: "WHEAT", amount: 5 },
    ],
    output: { type: "FERTILIZER", amount: 1 },
    craftTime: 10000,
    buffDescription: "Passive: 20% faster crop growth time.",
  },
  {
    id: "TRACTOR",
    name: "Tractor",
    description: "A heavy-duty machine for mass agricultural production.",
    ingredients: [
      { type: "IRON", amount: 10 },
      { type: "WOODEN_GEAR", amount: 5 },
    ],
    output: { type: "TRACTOR", amount: 1 },
    craftTime: 30000,
    buffDescription: "Passive: 2x crop yield when harvesting.",
  },
];
