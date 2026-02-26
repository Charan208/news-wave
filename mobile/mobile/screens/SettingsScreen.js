import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Switch,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { api, clearAuthToken } from '../api';

export default function SettingsScreen({ onLogout }) {
    const { theme, isDark, toggleTheme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState(null);

    // API Keys state
    const [keys, setKeys] = useState({
        thenewsapi: '',
        newsapi: '',
        worldnewsapi: '',
        nvidia: '',
    });

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            const res = await api.get('/api/user/me');
            if (res.error) throw new Error(res.error);
            setUser(res);
            if (res.keys) {
                setKeys({
                    thenewsapi: res.keys.thenewsapi || '',
                    newsapi: res.keys.newsapi || '',
                    worldnewsapi: res.keys.worldnewsapi || '',
                    nvidia: res.keys.nvidia || '',
                });
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to load user settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await api.post('/api/user/settings', { keys });
            if (res.error) throw new Error(res.error);
            Alert.alert('Success', 'Settings updated successfully');
        } catch (e) {
            Alert.alert('Save Failed', e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    await clearAuthToken();
                    onLogout();
                }
            }
        ]);
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>PROFILE</Text>
                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <View style={styles.row}>
                        <View style={[styles.avatar, { backgroundColor: theme.colors.primary + '20' }]}>
                            <Ionicons name="person" size={24} color={theme.colors.primary} />
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={[styles.username, { color: theme.colors.text }]}>{user?.username}</Text>
                            <Text style={[styles.userRole, { color: theme.colors.subtext }]}>Standard Intelligence Officer</Text>
                        </View>
                    </View>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>APPEARANCE</Text>
                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingLabel}>
                            <Ionicons name={isDark ? "moon" : "sunny"} size={20} color={theme.colors.text} />
                            <Text style={[styles.settingText, { color: theme.colors.text }]}>Dark Mode</Text>
                        </View>
                        <Switch
                            value={isDark}
                            onValueChange={toggleTheme}
                            trackColor={{ false: '#334155', true: theme.colors.primary }}
                        />
                    </View>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>PERSONAL API KEYS (OPTIONAL)</Text>
                <Text style={[styles.sectionNote, { color: theme.colors.subtext }]}>
                    Enter your own keys to increase rate limits. If empty, the app uses shared "Demo Mode" keys (5% server limit).
                </Text>

                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <KeyInput
                        label="TheNewsAPI Key"
                        value={keys.thenewsapi}
                        onChange={(v) => setKeys({ ...keys, thenewsapi: v })}
                        theme={theme}
                    />
                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                    <KeyInput
                        label="NewsAPI.org Key"
                        value={keys.newsapi}
                        onChange={(v) => setKeys({ ...keys, newsapi: v })}
                        theme={theme}
                    />
                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                    <KeyInput
                        label="WorldNewsAPI Key"
                        value={keys.worldnewsapi}
                        onChange={(v) => setKeys({ ...keys, worldnewsapi: v })}
                        theme={theme}
                    />
                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                    <KeyInput
                        label="NVIDIA NIM Key"
                        value={keys.nvidia}
                        onChange={(v) => setKeys({ ...keys, nvidia: v })}
                        theme={theme}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <Text style={styles.saveButtonText}>SAVE CONFIGURATION</Text>
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <TouchableOpacity
                    style={[styles.logoutButton, { borderColor: theme.colors.error }]}
                    onPress={handleLogout}
                >
                    <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
                    <Text style={[styles.logoutText, { color: theme.colors.error }]}>LOGOUT FROM NEWS WAVE</Text>
                </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

function KeyInput({ label, value, onChange, theme }) {
    return (
        <View style={styles.keyInputContainer}>
            <Text style={[styles.keyLabel, { color: theme.colors.subtext }]}>{label}</Text>
            <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                value={value}
                onChangeText={onChange}
                placeholder="Paste key here..."
                placeholderTextColor={theme.colors.subtext + '60'}
                secureTextEntry
                autoCapitalize="none"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1.5,
        marginBottom: 12,
        marginLeft: 4,
    },
    sectionNote: {
        fontSize: 12,
        lineHeight: 18,
        marginBottom: 16,
        marginLeft: 4,
        opacity: 0.8,
    },
    card: {
        borderWidth: 1,
        borderRadius: 16,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'center',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInfo: {
        marginLeft: 16,
    },
    username: {
        fontSize: 18,
        fontWeight: '800',
    },
    userRole: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
    },
    settingRow: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    settingLabel: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingText: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 12,
    },
    keyInputContainer: {
        padding: 16,
    },
    keyLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    input: {
        fontSize: 15,
        fontWeight: '600',
        padding: 0,
    },
    divider: {
        height: 1,
        width: '100%',
    },
    saveButton: {
        height: 54,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    saveButtonText: {
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1,
        color: '#000',
    },
    logoutButton: {
        flexDirection: 'row',
        height: 54,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    logoutText: {
        fontSize: 13,
        fontWeight: '800',
        marginLeft: 8,
        letterSpacing: 0.5,
    }
});
