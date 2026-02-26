import AsyncStorage from '@react-native-async-storage/async-storage';

// For Android EMULATOR use: http://10.0.2.2:3001
// For real device on same WiFi use: http://192.168.8.94:3001
export const SERVER = "https://news-wave-h6pf.onrender.com";
export const DEFAULT_KEY = "60D1RH77";

export const getAuthToken = async () => await AsyncStorage.getItem('auth_token');
export const setAuthToken = async (token) => await AsyncStorage.setItem('auth_token', token);
export const clearAuthToken = async () => await AsyncStorage.removeItem('auth_token');

export const getServerUrl = async () => await AsyncStorage.getItem('server_url') || SERVER;
export const setServerUrl = async (url) => await AsyncStorage.setItem('server_url', url);

export const getPairingKey = async () => await AsyncStorage.getItem('pairing_key');
export const setPairingKey = async (key) => await AsyncStorage.setItem('pairing_key', key);

let failCount = 0;

const handleFailure = async () => {
    failCount++;
    console.warn(`[API] Connection failure count: ${failCount}/3`);
    if (failCount >= 3) {
        console.error("[API] 3 consecutive failures. Clearing server URL for reconfiguration.");
        await AsyncStorage.removeItem('server_url');
        await AsyncStorage.removeItem('pairing_key');
        await AsyncStorage.removeItem('auth_token');
        failCount = 0;
        // Optionally reload or alert the user
    }
};

export const api = {
    get: async (path) => {
        try {
            const token = await getAuthToken();
            const baseUrl = await getServerUrl();
            const headers = {
                "Bypass-Tunnel-Reminder": "true",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            };
            const res = await fetch(`${baseUrl}${path}`, { headers }).then(r => r.json());
            failCount = 0; // Success! Reset counter
            return res;
        } catch (e) {
            await handleFailure();
            throw e;
        }
    },
    post: async (path, body) => {
        try {
            const token = await getAuthToken();
            const baseUrl = await getServerUrl();
            const headers = {
                "Content-Type": "application/json",
                "Bypass-Tunnel-Reminder": "true",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            };
            const res = await fetch(`${baseUrl}${path}`, { method: "POST", headers, body: JSON.stringify(body) }).then(r => r.json());
            failCount = 0; // Success! Reset counter
            return res;
        } catch (e) {
            await handleFailure();
            throw e;
        }
    },
    log: async (level, message, detail) => {
        try {
            const token = await getAuthToken();
            const baseUrl = await getServerUrl();
            const headers = {
                "Content-Type": "application/json",
                "Bypass-Tunnel-Reminder": "true",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            };
            const body = JSON.stringify({ level, message, detail });
            return fetch(`${baseUrl}/api/logs/remote`, { method: "POST", headers, body }).catch(() => { });
        } catch (e) {
            const baseUrl = await getServerUrl();
            return fetch(`${baseUrl}/api/logs/remote`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Bypass-Tunnel-Reminder": "true" },
                body: JSON.stringify({ level, message: `${message} (detail omitted: circular)` })
            }).catch(() => { });
        }
    }
};

export const CATS = [
    { id: "Technology", icon: "💻" },
    { id: "Cybersecurity", icon: "🛡️" },
    { id: "Hacking & Exploits", icon: "💀" },
    { id: "AI Agents", icon: "🤖" },
    { id: "AI Tools & Releases", icon: "🚀" },
    { id: "Science", icon: "🔬" },
    { id: "Business", icon: "📈" },
    { id: "Politics", icon: "🏛️" },
    { id: "Health", icon: "🏥" },
    { id: "World News", icon: "🌍" },
];

export const CRONS = [
    { label: "Every 10 min", expr: "*/10 * * * *" },
    { label: "Every 30 min", expr: "*/30 * * * *" },
    { label: "Every hour", expr: "0 * * * *" },
    { label: "Every 6h", expr: "0 */6 * * *" },
    { label: "Every 12h", expr: "0 */12 * * *" },
    { label: "Daily 8 AM", expr: "0 8 * * *" },
    { label: "Daily 9 PM", expr: "0 21 * * *" },
];
