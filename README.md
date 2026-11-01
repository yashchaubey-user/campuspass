# CampusPass — Decentralized College Event Ticketing dApp

A decentralised application on **Ethereum Sepolia** (Chain ID `11155111`) where college clubs list events and sell tickets for ETH.  
Listing metadata (title, description, poster) lives in a **SQLite database** to keep gas costs near zero; the blockchain stores only ticket sales, payments and a sha-256 hash of the listing for integrity.  
The server uses **sql.js** (pure-JavaScript SQLite) so it runs on any machine with Node.js — no C++ build tools required.

---

## Folder structure

```
campuspass/
├── contracts/
│   └── CampusEvents.sol      ← Solidity ^0.8.20, deploy in Remix IDE
├── server/
│   ├── package.json
│   └── server.js              ← Express + better-sqlite3, port 4000
├── frontend/
│   └── index.html             ← Vanilla JS + ethers.js v6.13.4
└── README.md
```

---

## How to run

### 1. Deploy the smart contract in Remix IDE

1. Open **[remix.ethereum.org](https://remix.ethereum.org)**.
2. Create a new file `CampusEvents.sol` and paste the contents of [`contracts/CampusEvents.sol`](contracts/CampusEvents.sol).
3. **Compile** with Solidity `0.8.20` or higher.
4. Set **Environment → Injected Provider - MetaMask** (make sure MetaMask is on Sepolia).
5. Click **Deploy**, confirm in MetaMask, then **copy the contract address**.

### 2. Paste the contract address into the frontend

Open [`frontend/index.html`](frontend/index.html) and find (near the top of the `<script>` block):

```js
const CONTRACT_ADDRESS = "0x69da390Ba498EfbA5D0d3e23BD4Bc9bFdC1457EB";
```

Replace the empty string with your address, e.g. `"0xAbC123..."`, and save.

### 3. Start the server

```bash
cd server
npm install
npm start
```

You should see: `CampusPass running on http://localhost:4000`

### 4. Open in Chrome

Go to **http://localhost:4000** in Chrome with MetaMask installed.

### 5. Get free Sepolia test ETH

| Faucet | URL |
|--------|-----|
| Google Cloud Web3 | https://cloud.google.com/application/web3/faucet/ethereum/sepolia |
| Sepolia PoW Faucet | https://sepolia-faucet.pk910.de/ |
| Alchemy | https://www.alchemy.com/faucets/ethereum-sepolia |
| Infura | https://www.infura.io/faucet/sepolia |

### 6. Try it

1. **Create an event** (price ≥ 0.0001 ETH).
2. Switch to a **second MetaMask account** and buy a ticket.
3. Check the **History** tab — all rows are built from on-chain event logs.

---

## Architecture notes

### Why store metadata in SQL instead of on-chain?

Ethereum storage is extremely expensive: writing a single 32-byte slot costs 20 000 gas (≈ US\$0.50–\$5 at mainnet prices). A title + description + poster would cost tens of dollars per listing. By storing only a `bytes32` sha-256 hash on-chain and keeping the full content in SQLite, an event listing costs about 100 000 gas (~\$0.01 on Sepolia) instead of millions.

### Why is state updated before sending ETH?

In `buyTicket`, the contract updates `sold`, `hasTicket` and `attendees` **before** calling `payable(organizer).call{value: msg.value}("")`. This follows the **Checks-Effects-Interactions** pattern: if the organiser is a malicious contract whose `receive()` tries to re-enter `buyTicket`, the guard checks (`"Already have a ticket"`, `"Sold out"`) will revert the re-entrant call because state was already updated.

### Why is the poster compressed in the browser?

Even though the poster is stored in SQL, not on-chain, the API limit is 1 MB per request. A high-resolution photo could be 5–10 MB. The browser canvas pipeline (starting at 800 px wide, JPEG quality 0.8, stepping down until the base64 string is under 300 000 characters ≈ 220 KB) ensures fast uploads and reasonable database size without any external image service.
