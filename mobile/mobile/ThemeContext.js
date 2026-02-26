import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const themes = {
    dark: {
        dark: true,
        colors: {
            primary: '#ffffff',
            background: '#000000',
            card: '#000000',
            text: '#ffffff',
            border: '#222222',
            subtext: '#999999',
            muted: '#111111',
            success: '#ffffff',
            error: '#ff5555',
        }
    },
    light: {
        dark: false,
        colors: {
            primary: '#000000',
            background: '#ffffff',
            card: '#ffffff',
            text: '#000000',
            border: '#dddddd',
            subtext: '#666666',
            muted: '#f5f5f5',
            success: '#000000',
            error: '#cc0000',
        }
    }
};

export const ThemeProvider = ({ children }) => {
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        const saved = await AsyncStorage.getItem('theme');
        if (saved !== null) setIsDark(saved === 'dark');
    };

    const toggleTheme = async () => {
        const newVal = !isDark;
        setIsDark(newVal);
        await AsyncStorage.setItem('theme', newVal ? 'dark' : 'light');
    };

    const theme = isDark ? themes.dark : themes.light;

    return (
        <ThemeContext.Provider value={{ isDark, theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
