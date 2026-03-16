import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';

// --- NEW: Import the Font Loader and the exact 700 Bold weight ---
import { useFonts, Fredoka_700Bold } from '@expo-google-fonts/fredoka';

import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { LibraryProvider } from './src/context/LibraryContext';
import RootNavigator from './src/navigation/RootNavigator';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function App() {
  // --- LOAD CUSTOM FONTS ---
  // We map 'Fredoka_700Bold' to the name 'Fredoka' so your RootNavigator can find it.
  let [fontsLoaded, fontError] = useFonts({
    Fredoka_700Bold, 
  });

  useEffect(() => {
    async function hideSplashScreen() {
      // Hide the splash screen once fonts are loaded (or if there was an error)
      if (fontsLoaded || fontError) {
        await SplashScreen.hideAsync();
      }
    }
    
    hideSplashScreen();
  }, [fontsLoaded, fontError]);

  // If the font isn't finished loading and there's no error, return null.
  // The native splash screen will remain visible until hideAsync() is called.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LibraryProvider>
          <ThemeProvider>
            <StatusBar style="light" />
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </ThemeProvider>
        </LibraryProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}