import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, CATS } from '../api';
import { useTheme } from '../ThemeContext';

const SEV_COLOR = { critical: '#f43f5e', high: '#fb923c', medium: '#fbbf24', low: '#4ade80', info: '#64748b' };

export default function FetchScreen() {
    const { theme, isDark } = useTheme();
    const [selCats, setSelCats] = useState([]);
    const [count, setCount] = useState(5);
    const [loading, setLoad] = useState(false);
    const [articles, setArts] = useState([]);
    const [sent, setSent] = useState(null);

    const toggle = (id) => setSelCats(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

    const doFetch = async () => {
        if (!selCats.length) return Alert.alert('Select at least one topic');
        setLoad(true); setArts([]); setSent(null);
        try {
            const d = await api.post('/api/news', { categories: selCats, count });
            setArts(d.articles || []);
        } catch (e) { Alert.alert('Error', e.message); }
        setLoad(false);
    };

    return (
        <ScrollView style={[s.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {/* Header section */}
            <View style={s.header}>
                <Text style={[s.title, { color: theme.colors.text }]}>Dispatch Center</Text>
                <Text style={[s.subtitle, { color: theme.colors.subtext }]}>Select topics to generate your custom news report</Text>
            </View>

            {/* Category selection */}
            <View style={s.section}>
                <View style={[s.sectionHeader, { borderBottomColor: theme.colors.border }]}>
                    <Text style={[s.sectionLabel, { color: theme.colors.subtext }]}>Feed Topics</Text>
                    <Text style={[s.badge, { backgroundColor: theme.colors.muted, color: theme.colors.text }]}>{selCats.length} active</Text>
                </View>
                <View style={s.catGrid}>
                    {CATS.map(c => {
                        const sel = selCats.includes(c.id);
                        return (
                            <TouchableOpacity
                                key={c.id}
                                onPress={() => toggle(c.id)}
                                style={[
                                    s.catBtn,
                                    { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                                    sel && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' }
                                ]}
                                activeOpacity={0.7}
                            >
                                <Text style={s.catIcon}>{c.icon}</Text>
                                <Text style={[s.catTxt, { color: theme.colors.subtext }, sel && { color: theme.colors.text }]}>{c.id}</Text>
                                {sel && <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} style={{ marginLeft: 4 }} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Config section */}
            <View style={s.configRow}>
                <View style={[s.configCard, { flex: 2, backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Text style={[s.tinyLabel, { color: theme.colors.subtext }]}>REPORT VOLUME</Text>
                    <View style={s.cntGrid}>
                        {[3, 5, 7, 10, 15].map(n => (
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

                <TouchableOpacity
                    style={[s.fetchBtn, { backgroundColor: theme.colors.primary }, (!selCats.length || loading) && { opacity: 0.5 }]}
                    onPress={doFetch}
                    disabled={!selCats.length || loading}
                >
                    {loading ? (
                        <ActivityIndicator color={isDark ? '#050505' : '#ffffff'} />
                    ) : (
                        <>
                            <Ionicons name="flash" size={18} color={isDark ? '#050505' : '#ffffff'} />
                            <Text style={[s.fetchTxt, { color: isDark ? '#050505' : '#ffffff' }]}>GENERATE</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Results */}
            <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
                {articles.length > 0 && (
                    <Text style={[s.resultsMeta, { color: theme.colors.muted }]}>FOUND {articles.length} CRITICAL FEED ITEMS</Text>
                )}
                {articles.map((a, i) => (
                    <View key={i} style={[s.articleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <View style={s.articleHeader}>
                            <View style={[s.sevTag, { backgroundColor: SEV_COLOR[a.severity] + '20' }]}>
                                <Text style={[s.sevText, { color: SEV_COLOR[a.severity] }]}>{(a.severity || 'info').toUpperCase()}</Text>
                            </View>
                            <Text style={[s.originText, { color: theme.colors.subtext }]}>{a.origin}</Text>
                        </View>

                        <Text style={[s.headline, { color: theme.colors.text }]}>{a.headline}</Text>
                        <Text style={[s.summary, { color: theme.colors.subtext }]} numberOfLines={3}>{a.summary}</Text>

                        <View style={[s.articleFooter, { borderTopColor: theme.colors.border }]}>
                            <View style={s.tagRow}>
                                {a.tags?.slice(0, 2).map((t, ti) => (
                                    <View key={ti} style={[s.miniTag, { backgroundColor: theme.colors.muted }]}>
                                        <Text style={[s.miniTagText, { color: theme.colors.subtext }]}>#{t.toUpperCase()}</Text>
                                    </View>
                                ))}
                            </View>
                            <TouchableOpacity style={[s.moreBtn, { backgroundColor: theme.colors.primary + '15' }]}>
                                <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 24, paddingTop: 16 },
    title: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
    subtitle: { fontSize: 13, marginTop: 4, lineHeight: 18, fontWeight: '500' },
    section: { paddingHorizontal: 16, marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 },
    badge: { fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    catBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
    catIcon: { fontSize: 14, marginRight: 8 },
    catTxt: { fontSize: 13, fontWeight: '600' },
    configRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, alignItems: 'flex-end' },
    configCard: { padding: 16, borderRadius: 16, borderWidth: 1 },
    tinyLabel: { fontSize: 9, fontWeight: '900', marginBottom: 12, letterSpacing: 1 },
    cntGrid: { flexDirection: 'row', gap: 6 },
    cntBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    cntTxt: { fontSize: 12, fontWeight: '800' },
    fetchBtn: { flex: 1, height: 80, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
    fetchTxt: { fontWeight: '900', fontSize: 14, letterSpacing: 1 },
    resultsMeta: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 16, textAlign: 'center' },
    articleCard: { borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1 },
    articleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sevTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    sevText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    originText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    headline: { fontSize: 16, fontWeight: '800', lineHeight: 22, marginBottom: 8 },
    summary: { fontSize: 13, lineHeight: 20 },
    articleFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1 },
    tagRow: { flexDirection: 'row', gap: 8 },
    miniTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    miniTagText: { fontSize: 9, fontWeight: '800' },
    moreBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
});
