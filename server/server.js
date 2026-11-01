const express = require("express");
const cors    = require("cors");
const crypto  = require("crypto");
const path    = require("path");
const fs      = require("fs");
const initSqlJs = require("sql.js");

const DB_PATH = path.join(__dirname, "campus.db");

async function main() {
  // ── initialise sql.js (pure-JS SQLite — no native build tools needed) ──
  const SQL = await initSqlJs();
  let db;
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS metadata (
    hash        TEXT PRIMARY KEY,
    organizer   TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    poster      TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed sample demo listings if database is empty
  const countRow = db.exec("SELECT COUNT(*) AS c FROM metadata");
  const count = countRow.length ? countRow[0].values[0][0] : 0;
  if (count === 0) {
    const seedEvents = [
      {
        hash: "0xd1a1111111111111111111111111111111111111111111111111111111111111",
        organizer: "0x71C83605662Cd8f67728565369172B20F7657929",
        title: "Campus PUBG Mobile Championship 2026",
        description: "Annual inter-college PUBG Mobile tournament! Squad TPP mode on Erangel & Miramar. 50,000 INR prize pool with live auditorium casting and gaming gear giveaways.",
        poster: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80"
      },
      {
        hash: "0xd2a2222222222222222222222222222222222222222222222222222222222222",
        organizer: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
        title: "HackSphere 36h Web3 Hackathon",
        description: "36-hour offline hackathon by the Blockchain Club. Tracks: Smart Contracts, AI Agents, and SocialFi. Free meals, Red Bull, mentors & sponsor bounties included.",
        poster: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80"
      },
      {
        hash: "0xd3a3333333333333333333333333333333333333333333333333333333333333",
        organizer: "0x4f1288B1AcF002444319aF0cFe9fEb2E6D5B4c9A",
        title: "Sunburn Campus EDM Night",
        description: "The grand cultural fest finale night! Featuring international guest DJ sets, laser visual show, and food trucks. Strictly college student ID & valid ticket required.",
        poster: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80"
      }
    ];

    seedEvents.forEach(e => {
      db.run(
        "INSERT INTO metadata (hash, organizer, title, description, poster) VALUES (?, ?, ?, ?, ?)",
        [e.hash, e.organizer, e.title, e.description, e.poster]
      );
    });
  }
  persist();

  function persist() {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  // ── express server ──────────────────────────────────────────────────
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // POST /api/metadata  →  save listing, return its sha-256 hash
  app.post("/api/metadata", (req, res) => {
    const { organizer, title, description = "", poster = "" } = req.body;

    if (!/^0x[0-9a-fA-F]{40}$/.test(organizer || "") || !title)
      return res.status(400).json({ error: "organizer wallet and title are required" });

    if (poster && !/^(https:\/\/|ipfs:\/\/|data:image\/jpeg;base64,)/.test(poster))
      return res.status(400).json({ error: "invalid poster" });

    const hash = "0x" + crypto.createHash("sha256")
      .update(JSON.stringify([organizer, title, description, poster, Date.now(), Math.random()]))
      .digest("hex");

    db.run(
      "INSERT INTO metadata (hash, organizer, title, description, poster) VALUES (?, ?, ?, ?, ?)",
      [hash, organizer, title, description, poster]
    );
    persist();

    res.json({ hash });
  });

  // GET /api/metadata  →  return every listing row
  app.get("/api/metadata", (_req, res) => {
    const rows = db.exec("SELECT hash, title, description, poster FROM metadata");
    if (!rows.length) return res.json([]);

    const cols = rows[0].columns; // ["hash","title","description","poster"]
    const out = rows[0].values.map(row => {
      const obj = {};
      cols.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
    res.json(out);
  });

  // serve frontend/index.html at http://localhost:4000
  app.use(express.static(path.join(__dirname, "../frontend")));

  app.listen(4000, () => console.log("CampusPass running on http://localhost:4000"));
}

main().catch(err => { console.error("Failed to start:", err); process.exit(1); });
