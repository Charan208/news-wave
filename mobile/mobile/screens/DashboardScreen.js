import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { useTheme } from '../ThemeContext';

export default function DashboardScreen() {
    const { theme, isDark, toggleTheme } = useTheme();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = async () => {
        try { setStatus(await api.get('/api/status')); }
        catch { setStatus(null); }
        setLoading(false); setRefreshing(false);
    };

    useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);

    if (loading) return (
        <View style={[s.center, { backgroundColor: theme.colors.background }]}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
    );

    const online = !!status;

    return (
        <ScrollView
            style={[s.container, { backgroundColor: theme.colors.background }]}
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
        >
            {/* Theme Toggle Section */}
            <View style={[s.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={s.rowBetween}>
                    <View style={s.row}>
                        <View style={[s.iconBg, { backgroundColor: theme.colors.primary + '15' }]}>
                            <Ionicons name={isDark ? "moon" : "sunny"} size={20} color={theme.colors.primary} />
                        </View>
                        <View style={{ marginLeft: 16 }}>
                            <Text style={[s.serviceTitle, { color: theme.colors.text }]}>Theme Engine</Text>
                            <Text style={[s.serviceStatus, { color: theme.colors.subtext }]}>{isDark ? 'Deep Midnight' : 'Clean White'}</Text>
                        </View>
                    </View>
                    <Switch
                        value={isDark}
                        onValueChange={toggleTheme}
                        trackColor={{ false: theme.colors.muted, true: theme.colors.primary + '50' }}
                        thumbColor={isDark ? theme.colors.primary : '#f4f3f4'}
                    />
                </View>
            </View>

            {/* Server status banner */}
            <View style={[s.statusBanner, {
                backgroundColor: online ? theme.colors.success + '05' : theme.colors.error + '05',
                borderColor: online ? theme.colors.success + '20' : theme.colors.error + '20'
            }]}>
                <View style={s.row}>
                    <View style={[s.pulseDot, { backgroundColor: online ? theme.colors.success : theme.colors.error }]} />
                    <View>
                        <Text style={[s.bannerTitle, { color: online ? theme.colors.success : theme.colors.error }]}>
                            {online ? 'SYSTEM OPERATIONAL' : 'SYSTEM OFFLINE'}
                        </Text>
                        {online && <Text style={[s.uptime, { color: theme.colors.subtext }]}>Live updates polling every 15s · {Math.floor((status.uptime || 0) / 60)}m Up</Text>}
                    </View>
                </View>
            </View>

            {/* Metrics */}
            {online && (
                <>
                    <View style={s.metricsRow}>
                        <StatBox label="History" value={status.historyCount ?? 0} icon="book-outline" theme={theme} />
                        <StatBox label="Logs" value={status.logsCount ?? 0} icon="pulse-outline" theme={theme} />
                    </View>

                    <View style={s.sectionHeader}>
                        <Text style={[s.sectionLabel, { color: theme.colors.subtext }]}>Active Services</Text>
                        <View style={[s.divider, { backgroundColor: theme.colors.border }]} />
                    </View>

                    {/* Scheduler Card */}
                    <TouchableOpacity style={[s.serviceCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <View style={[s.iconBg, { backgroundColor: status.scheduled ? theme.colors.success + '15' : theme.colors.subtext + '15' }]}>
                            <Ionicons name="time" size={20} color={status.scheduled ? theme.colors.success : theme.colors.subtext} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 16 }}>
                            <Text style={[s.serviceTitle, { color: theme.colors.text }]}>Auto-Fetch Scheduler</Text>
                            <Text style={[s.serviceStatus, { color: theme.colors.subtext }]}>
                                {status.scheduled ? `Active · ${status.config?.cronExpr}` : 'Inactive · No active schedule'}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.border} />
                    </TouchableOpacity>

                    {/* Sources Card */}
                    <View style={[s.sourcesCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <View style={s.row}>
                            <View style={[s.iconBg, { backgroundColor: theme.colors.primary + '15' }]}>
                                <Ionicons name="globe" size={20} color={theme.colors.primary} />
                            </View>
                            <Text style={[s.serviceTitle, { marginLeft: 16, color: theme.colors.text }]}>News Sources</Text>
                        </View>
                        <View style={s.sourceList}>
                            {Object.entries(status.sources || {}).map(([k, v]) => (
                                <View key={k} style={s.sourceItem}>
                                    <View style={[s.dotSmall, { backgroundColor: v ? theme.colors.success : theme.colors.error }]} />
                                    <Text style={[s.sourceName, { color: theme.colors.text }]}>{k}</Text>
                                    <Text style={[s.sourceStatus, { color: v ? theme.colors.success : theme.colors.error }]}>{v ? 'ONLINE' : 'DOWN'}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </>
            )}
        </ScrollView>
    );
}

function StatBox({ label, value, icon, theme }) {
    return (
        <View style={[s.statBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={s.statHeader}>
                <Ionicons name={icon} size={16} color={theme.colors.subtext} />
                <Text style={[s.statLbl, { color: theme.colors.subtext }]}>{label}</Text>
            </View>
            <Text style={[s.statVal, { color: theme.colors.text }]}>{value}</Text>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    sectionCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 20, padding: 16, borderWidth: 1 },
    statusBanner: { padding: 20, margin: 16, borderRadius: 16, borderWidth: 1 },
    pulseDot: { width: 10, height: 10, borderRadius: 5, marginRight: 16, marginTop: 4 },
    bannerTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
    uptime: { fontSize: 11, marginTop: 4, fontWeight: '500' },
    metricsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 24 },
    statBox: { borderRadius: 16, padding: 20, flex: 1, borderWidth: 1 },
    statHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
    statLbl: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    statVal: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16, gap: 16 },
    sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    divider: { flex: 1, height: 1 },
    serviceCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
    iconBg: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    serviceTitle: { fontSize: 15, fontWeight: '800' },
    serviceStatus: { fontSize: 12, marginTop: 4, fontWeight: '500' },
    sourcesCard: { marginHorizontal: 16, borderRadius: 20, padding: 20, borderWidth: 1 },
    sourceList: { marginTop: 20, gap: 12 },
    sourceItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
    dotSmall: { width: 6, height: 6, borderRadius: 3, marginRight: 12 },
    sourceName: { fontSize: 13, fontWeight: '600', flex: 1 },
    sourceStatus: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    row: { flexDirection: 'row', alignItems: 'center' },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
