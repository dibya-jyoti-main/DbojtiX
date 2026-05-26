const https = require("https");
const fs = require("fs");
const crypto = require("crypto");

// Hidden Secrets
const URL = process.env.X_STREAM_ENGINE_01;
const REFERER = process.env.X_REF_01;
const ORIGIN = process.env.X_ORIGIN_01;

const FILE = "main.js";

const HEADER = `
// ======================================================
// 🔥 DbojtiX By Dibya Jyoti
// ======================================================
//
// Updated By : Dibya Jyoti Mahanta 
// Auto Sync  : Every 12 Hours
//
// ======================================================

`;

function fetchFile(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
          "Accept": "*/*",
          "Referer": REFERER,
          "Origin": ORIGIN
        }
      },
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          resolve(data);
        });
      }
    ).on("error", reject);
  });
}

async function updateMainJS() {
  try {
    if (!URL) {
      throw new Error("❌ Secret URL not found.");
    }

    console.log("📥 Downloading latest main.js...");

    const fetchedData = await fetchFile(URL);

    if (!fetchedData || fetchedData.length < 100) {
      throw new Error("❌ Invalid or empty response.");
    }

    const newData = HEADER + fetchedData;

    let oldData = "";

    if (fs.existsSync(FILE)) {
      oldData = fs.readFileSync(FILE, "utf8");
    }

    const oldHash = crypto
      .createHash("md5")
      .update(oldData)
      .digest("hex");

    const newHash = crypto
      .createHash("md5")
      .update(newData)
      .digest("hex");

    if (oldHash === newHash) {
      console.log("✅ No changes detected.");
      process.exit(0);
    }

    fs.writeFileSync(FILE, newData);

    console.log("🔥 main.js updated successfully!");
  } catch (err) {
    console.error("❌ Update failed:");
    console.error(err.message);
    process.exit(1);
  }
}

updateMainJS();
