import React, { useState, useEffect } from 'react';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { ThemeProvider, useTheme } from './ThemeContext';
import { getAuthToken, api } from './api';

// Screens
import DashboardScreen from './screens/DashboardScreen';
import FetchScreen from './screens/FetchScreen';
import SchedulerScreen from './screens/SchedulerScreen';
import HistoryScreen from './screens/HistoryScreen';
import LogsScreen from './screens/LogsScreen';
import LoginScreen from './screens/LoginScreen';
import SettingsScreen from './screens/SettingsScreen';

const Drawer = createDrawerNavigator();

function CustomDrawerContent(props) {
  const { theme } = useTheme();
  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: theme.colors.background }}>
      <View style={[styles.drawerHeader, { borderBottomColor: theme.colors.border }]}>
        <Ionicons name="flash" size={32} color={theme.colors.primary} />
        <Text style={[styles.drawerTitle, { color: theme.colors.text }]}>NEWS WAVE</Text>
        <Text style={[styles.drawerSubtitle, { color: theme.colors.subtext }]}>Intelligence Hub v1.1.1</Text>
      </View>
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
}

function NavigationStack() {
  const { theme, isDark } = useTheme();
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    checkToken();
  }, []);

  const checkToken = async () => {
    const token = await getAuthToken();
    if (token) {
      try {
        const userData = await api.get('/api/user/me');
        if (!userData.error) setUser(userData);
        else setUser(null);
      } catch (e) {
        setUser(null);
      }
    }
    setCheckingAuth(false);
  };

  if (checkingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <NavigationContainer theme={theme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Drawer.Navigator
        initialRouteName="Feed"
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={({ route }) => ({
          headerStyle: {
            backgroundColor: theme.colors.background,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            height: 100,
          },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: '900', fontSize: 22, letterSpacing: -1 },
          drawerStyle: {
            backgroundColor: theme.colors.background,
            width: 280,
          },
          drawerActiveTintColor: theme.colors.primary,
          drawerInactiveTintColor: theme.colors.subtext,
          drawerActiveBackgroundColor: theme.colors.muted,
          drawerLabelStyle: { fontSize: 14, fontWeight: '800', marginLeft: -10 },
          drawerItemStyle: { borderRadius: 12, marginVertical: 4, paddingHorizontal: 8 },
          drawerIcon: ({ color, size }) => {
            const icons = {
              Feed: 'flash',
              Dashboard: 'pulse',
              Fetch: 'newspaper',
              Scheduler: 'timer',
              Settings: 'settings-sharp',
              Logs: 'terminal',
            };
            return <Ionicons name={icons[route.name]} size={size} color={color} />;
          },
        })}
      >
        <Drawer.Screen name="Feed" component={HistoryScreen} options={{ title: 'Live feed', headerTitle: 'News Wave', drawerLabel: 'Live feed' }} />
        <Drawer.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'System Status', headerTitle: 'System Status', drawerLabel: 'System Status' }} />
        <Drawer.Screen name="Fetch" component={FetchScreen} options={{ title: 'Manual Dispatch', headerTitle: 'Manual Dispatch', drawerLabel: 'Manual Dispatch' }} />
        <Drawer.Screen name="Scheduler" component={SchedulerScreen} options={{ title: 'Autonomous Engine', headerTitle: 'Autonomous Engine', drawerLabel: 'Autonomous Engine' }} />
        <Drawer.Screen name="Settings" options={{ title: 'User Settings', headerTitle: 'Settings' }}>
          {(props) => <SettingsScreen {...props} onLogout={() => setUser(null)} />}
        </Drawer.Screen>
        <Drawer.Screen name="Logs" component={LogsScreen} options={{ title: 'System Event Logs', headerTitle: 'System Logs', drawerLabel: 'System Logs' }} />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  drawerHeader: {
    padding: 24,
    paddingTop: 40,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  drawerTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 12,
    letterSpacing: -1,
  },
  drawerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    opacity: 0.7,
  }
});

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <NavigationStack />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
