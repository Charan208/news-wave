import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { useTheme } from '../ThemeContext';

export default function LogsScreen() {
    const { theme, isDark } = useTheme();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const d = await api.get('/api/logs');
            setLogs(d.logs || []);
        } catch (e) {
            console.error("Failed to fetch logs:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        load();
        const id = setInterval(load, 30000); // Poll every 30s
        return () => clearInterval(id);
    }, [load]);

    if (loading) return (
        <View style={[s.center, { backgroundColor: theme.colors.background }]}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
    );

    return (
        <ScrollView
            style={[s.container, { backgroundColor: theme.colors.background }]}
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />
            }
        >
            <View style={s.header}>
                <Ionicons name="pulse" size={20} color={theme.colors.subtext} />
                <Text style={[s.title, { color: theme.colors.subtext }]}>SYSTEM ACTIVITY</Text>
            </View>

            {logs.length === 0 ? (
                <View style={s.empty}>
                    <Text style={[s.emptyTxt, { color: theme.colors.border }]}>NO SYSTEM EVENTS RECORDED</Text>
                </View>
            ) : (
                logs.map((log, i) => (
                    <View key={i} style={[s.logCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <View style={s.logTop}>
                            <View style={[s.levelBadge, { backgroundColor: getLogColor(log.level) + '20' }]}>
                                <Text style={[s.levelText, { color: getLogColor(log.level) }]}>{log.level.toUpperCase()}</Text>
                            </View>
                            <Text style={[s.time, { color: theme.colors.subtext }]}>{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}</Text>
                        </View>

                        <Text style={[s.message, { color: theme.colors.text }]}>{log.message}</Text>

                        <View style={[s.logFooter, { borderTopColor: theme.colors.border }]}>
                            <Text style={[s.origin, { color: theme.colors.subtext }]}>SOURCE: {log.origin.toUpperCase()}</Text>
                            {log.detail && (
                                <TouchableOpacity style={[s.detailBtn, { backgroundColor: theme.colors.primary + '10' }]}>
                                    <Text style={[s.detailBtnText, { color: theme.colors.primary }]}>VIEW PAYLOAD</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {log.detail && (
                            <View style={[s.detailBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                                <Text style={[s.detailText, { color: theme.colors.subtext }]}>{JSON.stringify(log.detail, null, 2)}</Text>
                            </View>
                        )}
                    </View>
                ))
            )}
        </ScrollView>
    );
}

function getLogColor(level) {
    switch (level?.toLowerCase()) {
        case 'error': return '#ef4444';
        case 'warn': return '#fb923c';
        case 'info': return '#3b82f6';
        default: return '#10b981';
    }
}

const s = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 10 },
    title: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
    logCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 16, borderWidth: 1 },
    logTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    levelBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    levelText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
    time: { fontSize: 10, fontFamily: 'monospace' },
    message: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
    logFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
    origin: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
    detailBtn: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
    detailBtnText: { fontSize: 9, fontWeight: '900' },
    detailBox: { marginTop: 12, padding: 12, borderRadius: 8, borderWidth: 1 },
    detailText: { fontSize: 10, fontFamily: 'monospace' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
});
