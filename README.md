# 🌊 News Wave — Setup Guide

News Wave is an intelligent news aggregation system that fetches real-time updates from multiple sources, analyzes them using NVIDIA NIM (Llama 3.3), and delivers high-priority alerts directly to your mobile device.

## 🚀 What this does
- Fetches **real-time news** from 4 sources simultaneously (TheNewsAPI + NewsAPI.org + WorldNewsAPI + Hacker News).
- Removes duplicate articles automatically.
- Analyzes content via **NVIDIA NIM (Llama 3.3 70B)** for AI summaries and severity tagging.
- Sorts by threat severity: Critical → High → Medium → Low.
- **Autonomous Engine**: Schedules periodic news fetching and analysis.
- **Multi-User**: Secure individual accounts and preference management.
- **Remote Pairing**: Securely link your mobile app to your private server instance.

---

## 🔑 1. Server Setup (Node.js)

### Prerequisites
- Node.js v18+ 
- Fresh API Keys and Environment Variables:
   - `NIM_API_KEY` (NVIDIA NIM)
   - `THENEWSAPI_KEY`, `NEWSAPI_KEY`, `WORLDNEWSAPI_KEY`
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
   - `JWT_SECRET` (Strong random string)
   - `MONGODB_URI` (Required for cloud persistence - get from MongoDB Atlas)

### Installation
```bash
# 1. Install dependencies
npm install express cors dotenv node-fetch@2 node-cron lowdb@1 bcryptjs jsonwebtoken twilio mongoose

# 2. Create your .env file
cp .env.template .env
# Edit .env and paste your API keys
```

### Starting the Server
```bash
node server.js
```
On the first run, the server will generate a **Server Pairing Key**. Watch the console output for a line like:
`🔑 SERVER PAIRING KEY: ABCDEFGH`
**Keep this key safe!** You will need it to pair your mobile app.

---

## 📱 2. Mobile App Setup (Expo)

### Configuration
1. Install [Expo Go](https://expo.dev/go) on your phone.
2. In the app folder, edit `api.js` to point to your server URL (or skip this and use the in-app setup).

### Running
```bash
cd mobile
npm install
npx expo start
```
Scan the QR code with your phone.

### Linking to Server
1. On the Login Screen, click **SERVER NOT PAIRED**.
2. Enter your **Server URL** (e.g., `https://your-server.com` or your local IP).
3. Enter the **Pairing Key** from your server console.
4. Click **VERIFY & LINK**.

---

## 📡 API Endpoints

| Method | Path           | Description                        | Authentication |
|--------|----------------|------------------------------------|----------------|
| POST   | /auth/register | Create a new user account          | Pairing Key    |
| POST   | /auth/login    | Login and get JWT token            | None           |
| POST   | /api/news      | Fetch + analyze news now           | JWT            |
| POST   | /api/schedule  | Configure auto-fetch settings      | JWT            |
| GET    | /api/history   | View past news digests             | JWT            |

---

## ⏰ Cron Expression Examples

| Expression      | Meaning          |
|-----------------|------------------|
| `0 8 * * *`     | Daily at 8 AM    |
| `0 */6 * * *`   | Every 6 hours    |
| `*/30 * * * *`  | Every 30 minutes |

---

## 🛡️ Security
- **Strict Pairing**: Only users with the Server Pairing Key can register.
- **JWT Auth**: All API requests are protected by industry-standard JWT tokens.
- **Environment Safety**: Sensitive keys are never committed to version control.
- **Low Exposure**: The Pairing Key is only displayed in your local console.
