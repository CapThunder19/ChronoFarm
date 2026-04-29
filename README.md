# 🕰️ ChronoFarm

ChronoFarm is a premium, time-traveling, on-chain farming simulator built on Next.js, Wagmi, and Prisma. Players connect their crypto wallets (using RainbowKit) to plant crops, craft tools, trade resources, and travel across real-world historical eras to build their farming empire. The game uniquely merges traditional idle-farming mechanics with a dynamic global economy powered by regional markets and Web3 integration.

## ✨ Core Features

### 🚜 The Farm (Core Loop)
- **Planting & Harvesting:** Plant a variety of crops (Wheat, Potatoes, Tomatoes, Grapes, etc.) on a 6-plot farming grid. Each crop takes real-time to grow and yields varying amounts of base rewards.
- **Leveling System:** Gain experience points (XP) for every crop harvested. Leveling up unlocks more advanced crops and allows the player to travel further into different historical eras.
- **Time Advancing:** Once crops are ready, players can harvest them to add them to their warehouse inventory.

### ⚙️ Engineering Bay (Crafting System)
- **Raw Materials:** Acquire raw materials like **Wood** and **Iron** from the marketplace or via trading with other players.
- **Crafting Tools:** Use raw materials to craft specialized tools and upgrades (Wooden Gear, Fertilizer, Tractors).
- **Passive Buffs:** Crafted items automatically apply passive bonuses to your farm:
  - **Fertilizer:** Speeds up crop growth time by 20%.
  - **Tractor:** Doubles (2x) the harvest yield of all crops.

### 💰 Global Exchange (Marketplace & Economy)
- **Dynamic Supply & Demand:** The in-game economy features dynamic pricing based on supply and demand. Every time an item is bought or sold, its regional price adjusts accordingly.
- **Regional Dealers:** Different regions (Europe, Americas, Asia) have distinct Market Prices and NPCs.
- **Buy & Sell:** Players can sell their harvested crops to NPC merchants for in-game currency (`$`) or spend their money to buy raw materials and items they cannot grow themselves.

### 🌍 Time & Space Travel (The World Map)
- **Era Progression:** The game progresses through time (starting from 1910). Leveling up advances the timeline, triggering new eras and unique global events.
- **Global Events:** Dynamic historical events (e.g., "Peaceful Times", "Economic Boom", "Drought") randomly occur, affecting market multipliers and increasing the demand/price of specific crops.
- **Region Hopping:** Spend in-game currency to travel between continents. Certain crops can only be planted or sold at a premium in specific regions.

### ⛓️ Global Section (Web3 Trading Hub & Global Chat)
- **Real-Time Multiplayer Chat:** A globally synced chat room where all players can communicate, strategize, and negotiate trades.
- **On-Chain Player-to-Player Trading:** Players can list their warehouse inventory (crops, raw materials, crafted tools) for sale using **Sepolia ETH**.
- **Smart Contract Settlement:** Buyers execute a real Web3 transaction on the Sepolia Testnet. Once the transaction is confirmed, ChronoFarm securely transfers the items to the buyer's inventory, completely bridging off-chain game state with on-chain value transfer.

## 🛠️ Technology Stack

- **Frontend:** Next.js 15 (App Router), React, Tailwind CSS
- **Backend/API:** Next.js Serverless Route Handlers
- **Database:** PostgreSQL (managed via Prisma ORM)
- **Web3 Integration:** Wagmi, Viem, RainbowKit
- **Styling:** Highly-polished, glassmorphic UI with custom animations and dynamic dark-mode aesthetics.

## 🚀 Getting Started

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Database Setup:**
   Ensure your PostgreSQL database URL is set in the `.env` file, then run:
   ```bash
   npx prisma db push
   ```

3. **Start the Development Server:**
   ```bash
   npm run dev
   ```

4. **Play:**
   Open [http://localhost:3000](http://localhost:3000) in your browser. Connect your Web3 wallet (MetaMask, Phantom, etc.) on the Sepolia network to begin playing!
