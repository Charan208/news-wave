const BASE = "http://localhost:3001";
const PHONE = "+917780285693";

async function run() {
    // 1. Add recipient
    console.log("1️⃣  Adding recipient...");
    const r1 = await fetch(`${BASE}/api/recipients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", phone: PHONE, name: "My Phone" }),
    });
    const d1 = await r1.json();
    console.log("   →", d1.message || d1.error);

    // 2. Fetch 3 articles + autoSend
    console.log("\n2️⃣  Fetching 3 tech articles + auto-sending to WhatsApp...");
    const r2 = await fetch(`${BASE}/api/news`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            categories: ["Technology"],
            count: 15,
            autoSend: true,
        }),
    });
    const d2 = await r2.json();
    console.log(`   → ${d2.articles?.length} articles fetched`);
    console.log(`   → Sent: ${d2.sent}`);
    console.log(`   → Send result:`, JSON.stringify(d2.sendResult, null, 2));
}

run().catch(console.error);
