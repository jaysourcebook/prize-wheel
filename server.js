const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
const PRIZES_FILE = path.join(__dirname, "data", "prizes.json");

app.use(express.static("public"));
app.use(express.json());

function readPrizes() {
  return JSON.parse(fs.readFileSync(PRIZES_FILE, "utf-8"));
}

function writePrizes(prizes) {
  fs.writeFileSync(PRIZES_FILE, JSON.stringify(prizes, null, 2));
}

// Get available prizes (quantity > 0)
app.get("/api/prizes", (req, res) => {
  const prizes = readPrizes().filter((p) => p.quantity > 0);
  res.json(prizes);
});

// Spin — server picks the winner based on probability weights
app.post("/api/spin", (req, res) => {
  const allPrizes = readPrizes();
  const available = allPrizes.filter((p) => p.quantity > 0);

  if (available.length === 0) {
    return res.status(400).json({ error: "No prizes left" });
  }

  // Weighted random pick based on probability
  const totalWeight = available.reduce((sum, p) => sum + p.probability, 0);
  let rand = Math.random() * totalWeight;

  let winner = available[0];
  for (const prize of available) {
    rand -= prize.probability;
    if (rand <= 0) {
      winner = prize;
      break;
    }
  }

  // Decrement quantity in the master list
  const idx = allPrizes.findIndex((p) => p.name === winner.name);
  allPrizes[idx].quantity--;
  writePrizes(allPrizes);

  res.json({ winner: winner.name, is_prize: winner.is_prize !== false });
});

// Reset prizes (reload original file — you can keep a backup if needed)
app.post("/api/reset", (req, res) => {
  // Optional: you could store an original copy. For now just respond OK.
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Spin wheel running on http://localhost:${PORT}`));
