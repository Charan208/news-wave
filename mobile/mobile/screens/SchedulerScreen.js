import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, CATS, CRONS } from '../api';
import { useTheme } from '../ThemeContext';

function nextCronRun(expr) {
    if (!expr) return null;
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return null;
    const [minP, hourP, domP, monP, dowP] = parts;

    const matches = (val, pat) => {
        if (!pat || pat === '*') return true;
        if (pat.startsWith('*/')) {
            const step = parseInt(pat.slice(2));
            return !isNaN(step) && val % step === 0;
        }
        if (pat.includes('-')) {
            const [a, b] = pat.split('-').map(Number);
            return val >= a && val <= b;
        }
        if (pat.includes(',')) {
            return pat.split(',').map(Number).includes(val);
        }
        return val === parseInt(pat);
    };

    const next = new Date();
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);

    // Limit to 1 week to prevent long loops (7 * 24 * 60 = 10080)
    for (let i = 0; i < 10080; i++) {
        if (matches(next.getMinutes(), minP) &&
            matches(next.getHours(), hourP) &&
            matches(next.getDate(), domP) &&
            matches(next.getMonth() + 1, monP) &&
            matches(next.getDay(), dowP)) {
            return new Date(next);
        }
        next.setMinutes(next.getMinutes() + 1);
    }
    return null;
}

export default function SchedulerScreen() {
    const { theme, isDark } = useTheme();
    const [selCats, setSel] = useState([]);
    const [cron, setCron] = useState('');
    const [count, setCount] = useState(10);
    const [schedOn, setOn] = useState(false);
    const [msg, setMsg] = useState('');
    const [cd, setCd] = useState('');
    const [custN, setCustN] = useState('');
    const [custU, setCustU] = useState('min');
    const [fetching, setFetching] = useState(true);
    const [nextRun, setNextRun] = useState(null);

    const toggle = id => setSel(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

    // Initial sync with server
    useEffect(() => {
        const sync = async () => {
            try {
                const status = await api.get('/api/status');
                if (status.scheduled && status.config) {
                    setCron(status.config.cronExpr);
                    setSel(status.config.categories || []);
                    setCount(status.config.count || 10);
                    setOn(true);
                    setMsg('Scheduler is currently active on server.');
                }
            } catch (e) {
                api.log("error", "Sync error", e.message);
                setMsg('Failed to sync with server.');
            } finally {
                setFetching(false);
            }
        };
        sync();
    }, []);

    // Calculate next run only when cron or status changes
    useEffect(() => {
        if (!schedOn || !cron) {
            setNextRun(null);
            setCd('');
        } else {
            setNextRun(nextCronRun(cron));
        }
    }, [schedOn, cron]);

    // Lightweight countdown tick
    useEffect(() => {
        if (!nextRun) return;

        const tick = () => {
            const diff = nextRun - Date.now();
            if (diff <= 0) {
                setCd('Running now…');
                // Re-calculate next run after it hits 0
                setNextRun(nextCronRun(cron));
                return;
            }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setCd(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };

        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [nextRun, cron]);

    const buildCustomCron = useCallback((n, u) => {
        const num = parseInt(n);
        if (!num || num < 1) return;
        setCron(u === 'min' ? (num === 1 ? '* * * * *' : `*/${num} * * * *`) : (num === 1 ? '0 * * * *' : `0 */${num} * * *`));
    }, []);

    const start = async () => {
        if (!cron || !selCats.length) return Alert.alert('Select topics and a schedule');
        try {
            setMsg('Starting scheduler...');
            const d = await api.post('/api/schedule', { cronExpr: cron, categories: selCats, count, enabled: true });
            setOn(true);
            setMsg(d.message || 'Scheduler started');
        } catch (e) {
            setMsg('❌ ' + e.message);
        }
    };

    const stop = async () => {
        try {
            setMsg('Stopping scheduler...');
            await api.post('/api/schedule', { enabled: false });
            setOn(false);
            setMsg('Scheduler stopped.');
            setCd('');
        } catch (e) {
            setMsg('❌ ' + e.message);
        }
    };

    if (fetching) {
        return (
            <View style={[s.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ color: theme.colors.subtext, marginTop: 12 }}>Checking server status...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={[s.container, { backgroundColor: theme.colors.background }]} keyboardShouldPersistTaps="handled">

            {/* Status banner */}
            {schedOn && (
                <View style={[s.banner, { backgroundColor: theme.colors.success + '10', borderColor: theme.colors.success + '50' }]}>
                    <View style={s.bannerRow}>
                        <View style={[s.liveDot, { backgroundColor: theme.colors.success }]} />
                        <Text style={[s.bannerCron, { color: theme.colors.success }]}>{cron}</Text>
                        {cd ? <Text style={[s.countdown, { backgroundColor: theme.colors.primary + '20', color: theme.colors.primary }]}>{cd}</Text> : null}
                    </View>
                    <Text style={[s.bannerSub, { color: theme.colors.subtext }]}>Topics: {selCats.join(' · ') || '—'}</Text>
                </View>
            )}

            {/* Topics */}
            <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[s.label, { color: theme.colors.subtext }]}>TOPICS</Text>
                <View style={s.catGrid}>
                    {CATS.map(c => {
                        const sel = selCats.includes(c.id);
                        return (
                            <TouchableOpacity
                                key={c.id}
                                onPress={() => toggle(c.id)}
                                style={[
                                    s.catBtn,
                                    { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                                    sel && { borderColor: theme.colors.success, backgroundColor: theme.colors.success + '15' }
                                ]}
                            >
                                <Text style={{ fontSize: 12 }}>{c.icon}</Text>
                                <Text style={[s.catTxt, { color: theme.colors.subtext }, sel && { color: theme.colors.text }]} numberOfLines={1}>{c.id}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Count */}
            <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[s.label, { color: theme.colors.subtext }]}>ARTICLES PER RUN</Text>
                <View style={s.row}>
                    {[5, 10, 15, 20].map(n => (
                        <TouchableOpacity
                            key={n}
                            onPress={() => setCount(n)}
                            style={[
                                s.cntBtn,
                                { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                                count === n && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' }
                            ]}
                        >
                            <Text style={[s.cntTxt, { color: theme.colors.subtext }, count === n && { color: theme.colors.primary }]}>{n}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Presets */}
            <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[s.label, { color: theme.colors.subtext }]}>SCHEDULE PRESETS</Text>
                {CRONS.map(p => (
                    <TouchableOpacity
                        key={p.expr}
                        onPress={() => setCron(p.expr)}
                        style={[
                            s.preset,
                            { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                            cron === p.expr && { borderColor: theme.colors.success, backgroundColor: theme.colors.success + '15' }
                        ]}
                    >
                        <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{p.label}</Text>
                        <Text style={[s.presetExpr, { color: theme.colors.subtext }]}>{p.expr}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Custom interval */}
            <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[s.label, { color: theme.colors.subtext }]}>CUSTOM INTERVAL</Text>
                <View style={s.row}>
                    <TextInput
                        style={[s.input, { flex: 1, backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                        placeholder="e.g. 45"
                        placeholderTextColor={theme.colors.subtext} keyboardType="numeric" value={custN}
                        onChangeText={v => { setCustN(v); buildCustomCron(v, custU); }}
                    />
                    <TouchableOpacity
                        onPress={() => { const u = custU === 'min' ? 'hr' : 'min'; setCustU(u); buildCustomCron(custN, u); }}
                        style={[s.unitBtn, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '30' }]}
                    >
                        <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{custU === 'min' ? 'min' : 'hrs'}</Text>
                    </TouchableOpacity>
                </View>
                {cron ? <Text style={[s.cronPrev, { color: theme.colors.primary, backgroundColor: theme.colors.primary + '10' }]}>cron: {cron}</Text> : null}
            </View>


            {/* Buttons */}
            <View style={s.btnRow}>
                <TouchableOpacity style={[s.btn, { backgroundColor: theme.colors.success }, schedOn && { backgroundColor: theme.colors.muted }]} onPress={start}>
                    <Text style={[s.btnTxt, { color: isDark ? '#050505' : '#ffffff' }]}>{schedOn ? '🔄 Update' : '▶ Start'}</Text>
                </TouchableOpacity>
                {schedOn && (
                    <TouchableOpacity style={[s.btn, { backgroundColor: theme.colors.error }]} onPress={stop}>
                        <Text style={[s.btnTxt, { color: '#ffffff' }]}>■ Stop</Text>
                    </TouchableOpacity>
                )}
            </View>

            {msg ? <Text style={[s.msgTxt, { color: theme.colors.subtext }]}>{msg}</Text> : null}
            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    card: { borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1 },
    label: { fontSize: 10, letterSpacing: 1.5, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase' },
    banner: { borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1 },
    bannerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    liveDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    bannerCron: { fontFamily: 'monospace', fontWeight: '700', flex: 1 },
    countdown: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, fontFamily: 'monospace', fontSize: 13, fontWeight: '700' },
    bannerSub: { fontSize: 11, marginTop: 2 },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    catBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
    catTxt: { fontSize: 10, fontWeight: '500', maxWidth: 80 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cntBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
    cntTxt: { fontWeight: '700' },
    preset: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, marginBottom: 7 },
    presetExpr: { fontFamily: 'monospace', fontSize: 11 },
    input: { borderWidth: 1, borderRadius: 10, padding: 12, fontFamily: 'monospace' },
    unitBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
    cronPrev: { fontSize: 11, fontFamily: 'monospace', marginTop: 8, padding: 8, borderRadius: 7 },
    btnRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    btn: { flex: 1, borderRadius: 12, padding: 15, alignItems: 'center' },
    btnTxt: { fontWeight: '700', fontSize: 14 },
    msgTxt: { textAlign: 'center', marginBottom: 16, fontSize: 12 },
});
