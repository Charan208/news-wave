import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { useTheme } from '../ThemeContext';

const SEV_COLOR = { critical: '#f43f5e', high: '#fb923c', medium: '#fbbf24', low: '#4ade80', info: '#64748b' };

export default function HistoryScreen() {
    const { theme, isDark } = useTheme();
    const [digests, setDigests] = useState([]);
    const [loading, setLoad] = useState(true);
    const [refreshing, setRef] = useState(false);
    const [expanded, setExp] = useState(null);

    const load = useCallback(async () => {
        try { const d = await api.get('/api/history'); setDigests(d.digests || []); }
        catch { setDigests([]); }
        setLoad(false); setRef(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const openLink = (url) => {
        if (url) Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    };

    if (loading) return (
        <View style={[s.center, { backgroundColor: theme.colors.background }]}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
    );

    return (
        <ScrollView
            style={[s.container, { backgroundColor: theme.colors.background }]}
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRef(true); load(); }} tintColor={theme.colors.primary} />}>

            {digests.length === 0 && (
                <View style={s.empty}>
                    <Ionicons name="documents-outline" size={64} color={theme.colors.subtext} />
                    <Text style={[s.emptyTxt, { color: theme.colors.text }]}>NO ARCHIVED FEEDS</Text>
                    <Text style={[s.emptySub, { color: theme.colors.subtext }]}>Fetch news to build your history</Text>
                </View>
            )}

            {digests.map((d, i) => {
                const isLatest = i === 0;
                const open = expanded === i;
                const ts = new Date(d.timestamp || d.fetchedAt);
                return (
                    <View key={i} style={[
                        s.card,
                        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                        open && { borderColor: theme.colors.primary + '33' },
                        isLatest && {
                            borderColor: theme.colors.primary + '66',
                            shadowColor: theme.colors.primary,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.2,
                            shadowRadius: 10,
                            elevation: 4
                        }
                    ]}>
                        <TouchableOpacity onPress={() => setExp(open ? null : i)} activeOpacity={0.9} style={s.cardHeader}>
                            <View style={s.headerMain}>
                                <View style={s.topRow}>
                                    <Text style={[s.date, { color: theme.colors.text }]}>
                                        {ts.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()} · {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                    {isLatest && (
                                        <View style={[s.liveBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                                            <View style={[s.liveDot, { backgroundColor: theme.colors.primary }]} />
                                            <Text style={[s.liveText, { color: theme.colors.primary }]}>LIVE FEED</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={[s.cats, { color: theme.colors.subtext }]} numberOfLines={1}>{(d.categories || []).join(' · ')}</Text>
                            </View>

                            <View style={s.metaCol}>
                                <View style={[s.countBadge, { backgroundColor: theme.colors.muted }]}>
                                    <Text style={[s.countText, { color: theme.colors.text }]}>{d.articles?.length || 0}</Text>
                                </View>
                                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={theme.colors.subtext} />
                            </View>
                        </TouchableOpacity>

                        {/* Severity Line */}
                        <View style={s.summaryLine}>
                            {d.critical > 0 && <View style={[s.dotShort, { backgroundColor: SEV_COLOR.critical }]} />}
                            {d.high > 0 && <View style={[s.dotShort, { backgroundColor: SEV_COLOR.high }]} />}
                            <Text style={[s.statsText, { color: theme.colors.subtext }]}>{d.elapsed}S ELAPSED · {d.sources?.length} SOURCES</Text>
                        </View>

                        {/* Expanded Content */}
                        {open && (
                            <View style={[s.expandedContent, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
                                {(d.articles || []).map((a, j) => (
                                    <View key={j} style={s.articleItem}>
                                        <View style={[s.sevIndicator, { backgroundColor: SEV_COLOR[a.severity] || theme.colors.subtext }]} />
                                        <TouchableOpacity style={{ flex: 1 }} onPress={() => openLink(a.url)}>
                                            <Text style={[s.artTitle, { color: theme.colors.text }]}>{a.headline}</Text>
                                            {a.summary && <Text style={[s.artSummary, { color: theme.colors.subtext }]}>{a.summary}</Text>}
                                            <Text style={[s.artOrigin, { color: theme.colors.subtext }]}>{a.origin.toUpperCase()}</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    style={[s.fullReportBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                                    onPress={() => openLink(d.articles?.[0]?.url)}
                                >
                                    <Text style={[s.fullReportBtnText, { color: theme.colors.primary }]}>VIEW FULL REPORT</Text>
                                    <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                );
            })}
        </ScrollView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    card: { marginHorizontal: 16, marginVertical: 6, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
    cardHeader: { padding: 16, flexDirection: 'row', alignItems: 'center' },
    headerMain: { flex: 1 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    date: { fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, gap: 5 },
    liveDot: { width: 6, height: 6, borderRadius: 3 },
    liveText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
    cats: { fontSize: 11, marginTop: 4, fontWeight: '500' },
    metaCol: { alignItems: 'center', flexDirection: 'row', gap: 12 },
    countBadge: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    countText: { fontSize: 12, fontWeight: '900' },
    summaryLine: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 6 },
    dotShort: { width: 8, height: 4, borderRadius: 2 },
    statsText: { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginLeft: 4 },
    expandedContent: { borderTopWidth: 1, padding: 16 },
    articleItem: { flexDirection: 'row', marginBottom: 20, gap: 12 },
    sevIndicator: { width: 3, height: '100%', borderRadius: 2 },
    artTitle: { fontSize: 13, fontWeight: '700', lineHeight: 18, marginBottom: 4 },
    artSummary: { fontSize: 11, lineHeight: 16, marginBottom: 6 },
    artOrigin: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
    fullReportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 1, gap: 8, marginTop: 8 },
    fullReportBtnText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyTxt: { fontSize: 14, fontWeight: '900', marginTop: 24, letterSpacing: 2 },
    emptySub: { fontSize: 12, marginTop: 8, fontWeight: '500' },
});
