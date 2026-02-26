import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { api, setAuthToken, getServerUrl, setServerUrl, getPairingKey, setPairingKey, SERVER, DEFAULT_KEY } from '../api';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';

export default function LoginScreen({ onLoginSuccess }) {
    const { theme } = useTheme();
    const [pairingKey, setPairingKeyState] = useState('');
    const [serverUrl, setServerUrlState] = useState(SERVER);
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        checkExistingLink();
    }, []);

    const checkExistingLink = async () => {
        const storedKey = await getPairingKey();
        const storedUrl = await getServerUrl();

        // Always pre-fill with defaults if stored values are missing
        setPairingKeyState(storedKey || '');
        setServerUrlState(storedUrl || SERVER);
    };

    const handleLinkServer = async () => {
        if (!serverUrl || !pairingKey) {
            Alert.alert('Missing Info', 'Please enter both the Server URL and the Connection Key from your web dashboard.');
            return;
        }

        setLoading(true);
        try {
            // Clean the URL
            const formattedUrl = serverUrl.trim().replace(/\/$/, "");
            await setServerUrl(formattedUrl);

            // Attempt to link using the new endpoint
            const res = await api.post('/auth/link-app', { pairingKey });

            if (res.success && res.token) {
                await setPairingKey(pairingKey);
                await setAuthToken(res.token);
                onLoginSuccess(res.user);
            } else {
                Alert.alert('Link Failed', res.error || 'Invalid connection key.');
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Connection Error', 'Could not reach the server. Please check your URL and connection.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: theme.colors.background }]}
        >
            <View style={styles.inner}>
                <Animated.View entering={FadeInUp} style={styles.header}>
                    <Ionicons name="flash" size={80} color={theme.colors.primary} />
                    <Text style={[styles.title, { color: theme.colors.text }]}>NEWS WAVE</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.subtext }]}>
                        Intelligence Hub Link
                    </Text>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(200)} style={styles.form}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>
                        Link Your Device
                    </Text>
                    <Text style={[styles.description, { color: theme.colors.subtext }]}>
                        To keep your communications private, linking requires your unique server key found in your web dashboard.
                    </Text>

                    <View style={[styles.inputContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <Ionicons name="globe-outline" size={20} color={theme.colors.subtext} />
                        <TextInput
                            style={[styles.input, { color: theme.colors.text }]}
                            placeholder="Server URL (e.g. http://192.168.8.102:3001)"
                            placeholderTextColor={theme.colors.subtext}
                            value={serverUrl}
                            onChangeText={setServerUrlState}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={[styles.inputContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <Ionicons name="key-outline" size={20} color={theme.colors.subtext} />
                        <TextInput
                            style={[styles.input, { color: theme.colors.text }]}
                            placeholder="Connection Key"
                            placeholderTextColor={theme.colors.subtext}
                            value={pairingKey}
                            onChangeText={setPairingKeyState}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.colors.primary }]}
                        onPress={handleLinkServer}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.buttonText}>ESTABLISH SECURE LINK</Text>
                                <Ionicons name="arrow-forward" size={18} color="#000" style={{ marginLeft: 8 }} />
                            </View>
                        )}
                    </TouchableOpacity>
                </Animated.View>

                <View style={styles.footer}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.primary} />
                    <Text style={[styles.footerText, { color: theme.colors.subtext }]}>
                        Encrypted Connection Powered by NVIDIA NIM
                    </Text>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    inner: {
        flex: 1,
        padding: 32,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 60,
    },
    title: {
        fontSize: 36,
        fontWeight: '900',
        marginTop: 16,
        letterSpacing: -2,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '700',
        marginTop: 4,
        letterSpacing: 2,
        textTransform: 'uppercase',
        opacity: 0.6,
    },
    form: {
        width: '100%',
    },
    label: {
        fontSize: 22,
        fontWeight: '900',
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 32,
        opacity: 0.8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 16,
        height: 64,
    },
    input: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        fontWeight: '600',
    },
    button: {
        height: 64,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    buttonText: {
        color: '#000',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 1,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
    },
    footerText: {
        fontSize: 12,
        fontWeight: '700',
        marginLeft: 8,
        opacity: 0.5,
    },
});
