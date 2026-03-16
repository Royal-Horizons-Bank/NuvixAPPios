// src/navigation/RootNavigator.js
import React, { useContext, useEffect } from 'react';
import { useWindowDimensions, View, Text, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer'; 
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; 
import * as ScreenOrientation from 'expo-screen-orientation'; 

import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext'; 
import TopBar from '../components/TopBar';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

// --- SCREENS ---
import AuthScreen from '../screens/AuthScreen'; 
import ProfileSelectionScreen from '../screens/ProfileSelectionScreen'; 
import HomeScreen from '../screens/HomeScreen';
import BrowseScreen from '../screens/BrowseScreen';
import SearchScreen from '../screens/SearchScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LibraryScreen from '../screens/LibraryScreen';
import DetailsScreen from '../screens/DetailsScreen';

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

// ============================================================================
// 1. MOBILE BOTTOM TABS (🔥 Fixed PWA Floating Gap & 3-Button Nav)
// ============================================================================
const MobileNavigator = () => {
  const { theme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  
  const isWeb = Platform.OS === 'web';

  // For native Android/iOS, we rely on the standard insets or our safe fallbacks
  const nativeSafeBottom = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 20 : 10);
  const baseTabBarHeight = 60; 
  const nativeTotalHeight = baseTabBarHeight + nativeSafeBottom;

  return (
    <Tab.Navigator
      // Web: Push content up using dynamic CSS so it never hides behind the fixed tab bar
      // Native: Use standard numeric height padding
      sceneContainerStyle={{ 
        paddingBottom: isWeb ? `calc(${baseTabBarHeight}px + env(safe-area-inset-bottom))` : nativeTotalHeight 
      }}
      
      screenOptions={({ route }) => ({
        header: () => <TopBar />, 
        
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Browse') iconName = focused ? 'grid' : 'grid-outline';
          else if (route.name === 'Search') iconName = focused ? 'search' : 'search-outline';
          else if (route.name === 'Library') iconName = focused ? 'bookmark' : 'bookmark-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          return <Ionicons name={iconName} size={26} color={color} />;
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarShowLabel: false, 
        
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: Platform.OS === 'ios' || isWeb ? 8 : 0, 
        },

        // 🔥 THE FIX: Web uses 'fixed' to completely ignore parent wrapper gaps 
        // and snaps straight to the physical screen edge.
        tabBarStyle: {
          position: isWeb ? 'fixed' : 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0, 
          borderTopWidth: 1, 
          borderTopColor: theme.border,
          backgroundColor: theme.surface, 
          // Use native CSS variables on web to perfectly stretch the background into the home indicator area
          height: isWeb ? `calc(${baseTabBarHeight}px + env(safe-area-inset-bottom))` : nativeTotalHeight, 
          paddingBottom: isWeb ? 'env(safe-area-inset-bottom)' : nativeSafeBottom, 
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ headerTransparent: true }} 
      />
      <Tab.Screen name="Browse" component={BrowseScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

// ============================================================================
// 2. CUSTOM SIDEBAR HEADER (NUVIX+ TEXT)
// ============================================================================
const CustomDrawerContent = (props) => {
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
      <View style={{ paddingHorizontal: 25, paddingTop: 40, paddingBottom: 30, justifyContent: 'center' }}>
        
        <View style={styles.logoContainer}>
          {/* 1. The Drop Shadow layer */}
          <Text style={[styles.logoText, styles.shadowText]}>
            Nuvix+
          </Text>

          {/* 2. The Gradient Text layer */}
          {Platform.OS === 'web' ? (
            <Text
              style={[
                styles.logoText,
                {
                  backgroundImage: 'linear-gradient(90deg, #6ae70e 0%, #08fded 20%, #0072ed 60%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                },
              ]}
            >
              Nuvix+
            </Text>
          ) : (
            <MaskedView
              maskElement={<Text style={styles.logoText}>Nuvix+</Text>}
            >
              <LinearGradient
                colors={['#6ae70e', '#08fded', '#0072ed']}
                locations={[0, 0.2, 0.6]}
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 0 }}
                style={{ flexDirection: 'row' }}
              >
                <Text style={[styles.logoText, { opacity: 0 }]}>
                  Nuvix+
                </Text>
              </LinearGradient>
            </MaskedView>
          )}
        </View>

      </View>
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  logoContainer: {
    position: 'relative', 
  },
  logoText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 32,
    letterSpacing: 1,
    backgroundColor: 'transparent',
  },
  shadowText: {
    position: 'absolute',
    top: 2, 
    left: 1, 
    color: 'rgba(0, 0, 0, 0.25)', 
  }
});

// ============================================================================
// 3. TABLET DRAWER NAVIGATOR (For iPads / Large Screens)
// ============================================================================
const TabletNavigator = () => {
  const { theme } = useContext(ThemeContext);

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />} 
      screenOptions={{
        header: () => <TopBar />, 
        drawerType: 'permanent', 
        drawerStyle: {
          backgroundColor: theme.background, 
          width: 250,
          borderRightColor: theme.border,
          borderRightWidth: 1,
        },
        drawerActiveTintColor: theme.primary,
        drawerInactiveTintColor: theme.textSecondary,
        drawerActiveBackgroundColor: theme.primary + '33', 
      }}
    >
      <Drawer.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ 
          drawerIcon: ({color}) => <Ionicons name="home-outline" size={22} color={color} />,
          headerTransparent: true 
        }} 
      />
      <Drawer.Screen 
        name="Browse" 
        component={BrowseScreen} 
        options={{ drawerIcon: ({color}) => <Ionicons name="grid-outline" size={22} color={color} /> }} 
      />
      <Drawer.Screen 
        name="Search" 
        component={SearchScreen} 
        options={{ drawerIcon: ({color}) => <Ionicons name="search-outline" size={22} color={color} /> }} 
      />
      <Drawer.Screen 
        name="Library" 
        component={LibraryScreen} 
        options={{ drawerIcon: ({color}) => <Ionicons name="bookmark-outline" size={22} color={color} /> }} 
      />
      <Drawer.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ drawerIcon: ({color}) => <Ionicons name="person-outline" size={22} color={color} /> }} 
      />
    </Drawer.Navigator>
  );
};

// ============================================================================
// 4. MAIN ROOT STACK (3-TIER GATEKEEPER APPLIED HERE)
// ============================================================================
export default function RootNavigator() {
  const { width, height } = useWindowDimensions();
  
  // Grab the Auth state
  const { activeProfileKey, user, isGuest, loading } = useContext(AuthContext); 
  
  // Robust check: iOS uses native isPad flag, Android checks if shortest screen side is >= 600
  const isTabletDevice = Platform.OS === 'ios' ? Platform.isPad : Math.min(width, height) >= 600; 
  
  // Check if the device is currently rotated into Landscape mode
  const isLandscape = width > height;

  // Only use the Sidebar Drawer if it's a tablet AND it's in Landscape
  const useSidebar = isTabletDevice && isLandscape;

  // THE ORIENTATION MANAGER
  useEffect(() => {
    async function lockOrientation() {
      if (isTabletDevice) {
        // Tablets: Free rotation (Landscape & Portrait)
        await ScreenOrientation.unlockAsync();
      } else {
        // Phones: Strictly locked to Portrait 
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    }
    lockOrientation();
  }, [isTabletDevice]);

  // Loading Screen while Firebase checks credentials on boot
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0071eb" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      
      {/* 🛑 LEVEL 1 GATEKEEPER: Are they logged in or a Guest? */}
      {(!user && !isGuest) ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : 
      
      /* 🛑 LEVEL 2 GATEKEEPER: Have they selected a profile? */
      !activeProfileKey ? (
        <Stack.Screen name="ProfileSelection" component={ProfileSelectionScreen} />
      ) : (
        
      /* ✅ LEVEL 3: Access Granted to Main App */
        <>
          <Stack.Screen 
             name="MainTabs" 
             // Switches instantly to Bottom Tabs if portrait, or Sidebar if landscape!
             component={useSidebar ? TabletNavigator : MobileNavigator} 
          />
          
          <Stack.Screen 
            name="Details" 
            component={DetailsScreen} 
            options={{ presentation: 'modal' }} 
          />
        </>
      )}
    </Stack.Navigator>
  );
}