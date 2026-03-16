// src/screens/LibraryScreen.js
import React, { useState, useEffect, useContext, useRef, memo, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, 
  ActivityIndicator, Animated, useWindowDimensions, LayoutAnimation, UIManager, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeContext } from '../context/ThemeContext';
import { LibraryContext } from '../context/LibraryContext';
import { SIZES } from '../constants/theme';

// 🔥 Enable LayoutAnimation for Android to allow fluid grid shifting
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const API_KEY = "55550670b2e9a6b8c3c3c69b0bdf894f";
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w342";

// ============================================================================
// 1. LIBRARY CARD (🔥 Fixed Database Type Extraction)
// ============================================================================
const LibraryCard = memo(({ item, itemWidth, theme, navigateToDetails, tappedCardId, setTappedCardId, isHistory }) => {
  const isTapped = tappedCardId === item.id;
  const [hasMounted, setHasMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [bannerText, setBannerText] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current; 
  const iconScale = useRef(new Animated.Value(1)).current;
  
  const { toggleWatchlist, isInWatchlist, removeFromHistory } = useContext(LibraryContext);
  const inList = isInWatchlist(item.id);

  

  const itemHeight = itemWidth * 1.5;
  
  // 🔥 THE FIX: Safely extracts the type from your database (handling custom 'type' keys)
  // Falls back to checking if the object has a 'name' (unique to TV shows)
  const rawType = item.media_type || item.type || item.mediaType;
  const mediaType = rawType ? String(rawType).toLowerCase() : (item.name || item.first_air_date ? 'tv' : 'movie');

  useEffect(() => {
    let isMounted = true;
    let timeoutId;
    
    cardScale.setValue(1);
    cardOpacity.setValue(1);
    fadeAnim.setValue(0);
    setHasMounted(false);
    setIsExiting(false);

    if (item.latest_update_text) {
        setBannerText(item.latest_update_text);
    } else {
        setBannerText(null);
        if (mediaType === 'movie' && item.release_date && new Date(item.release_date) > new Date()) {
            setBannerText("Coming Soon");
        } else if (mediaType === 'tv') {
            const delay = Math.floor(Math.random() * 2500) + 100;
            timeoutId = setTimeout(async () => {
                if (!isMounted) return;
                try {
                  const res = await fetch(`${BASE_URL}/tv/${item.id}?api_key=${API_KEY}`);
                  if (!res.ok) return;
                  const tvShow = await res.json();
                  if (!tvShow || !tvShow.last_air_date) return;
                  const lastAirDate = new Date(tvShow.last_air_date);
                  const oneMonthAgo = new Date();
                  oneMonthAgo.setMonth(new Date().getMonth() - 1);
                  if (lastAirDate >= oneMonthAgo) {
                      if (tvShow.last_episode_to_air?.episode_number === 1 && new Date(tvShow.last_episode_to_air.air_date) >= oneMonthAgo) {
                          if (isMounted) setBannerText("New Season");
                      } else {
                          if (isMounted) setBannerText("New Episode");
                      }
                  }
                } catch (error) {}
            }, delay);
        }
    }
    
    return () => { 
      isMounted = false; 
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [item, mediaType]);

  useEffect(() => {
    if (isTapped) {
      setHasMounted(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 80, useNativeDriver: true }).start();
    } else if (hasMounted) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [isTapped]);

  const handlePressIn = () => {
    if (!isExiting) Animated.timing(cardScale, { toValue: 0.96, duration: 60, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    if (!isExiting) Animated.spring(cardScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
  };

  const handlePress = () => {
    if (isExiting) return;
    if (isTapped) {
      setTappedCardId(null);
      // 🔥 Will now flawlessly route TV shows to the TV screen!
      navigateToDetails(item.id, mediaType);
    } else {
      Animated.sequence([
        Animated.timing(cardScale, { toValue: 0.95, duration: 60, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true })
      ]).start();
      setTappedCardId(item.id);
    }
  };

  const handleActionPress = () => {
    const isRemovingFromView = (isHistory && !inList) || (!isHistory && inList);

    if (isRemovingFromView) {
        setIsExiting(true);
        Animated.parallel([
            Animated.timing(cardScale, { toValue: 0.5, duration: 150, useNativeDriver: true }),
            Animated.timing(cardOpacity, { toValue: 0, duration: 150, useNativeDriver: true })
        ]).start(() => {
            const customSpringConfig = {
              duration: 400,
              update: { type: LayoutAnimation.Types.spring, springDamping: 0.7 },
              delete: { type: LayoutAnimation.Types.easeIn, property: LayoutAnimation.Properties.opacity }
            };
            LayoutAnimation.configureNext(customSpringConfig);
            if (isHistory && !inList) removeFromHistory(item.id);
            else toggleWatchlist(item);
            setTappedCardId(null);
        });
    } else {
        Animated.sequence([
          Animated.timing(iconScale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
          Animated.spring(iconScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true })
        ]).start();
        if (isHistory && !inList) removeFromHistory(item.id);
        else toggleWatchlist(item);
        setTimeout(() => setTappedCardId(null), 300);
    }
  };

  if (!item.poster_path) return null;

  return (
    <TouchableOpacity activeOpacity={1} delayPressIn={0} onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handlePress} style={{ width: itemWidth, height: itemHeight }}>
      <Animated.View style={[styles.cardWrapper, { width: '100%', height: '100%', transform: [{ scale: cardScale }], opacity: cardOpacity }]}>
        <Image source={{ uri: `${IMG_BASE}${item.poster_path}` }} style={[styles.cardImage, { borderColor: theme.border }]} />
        {bannerText && (
          <View style={[styles.bannerTag, { backgroundColor: theme.primary }]}>
            <Text style={styles.bannerText}>{bannerText}</Text>
          </View>
        )}
        {hasMounted && (
          <Animated.View pointerEvents={isTapped ? "auto" : "none"} style={[StyleSheet.absoluteFillObject, styles.overlayBase, { opacity: fadeAnim }]}>
            <TouchableOpacity style={styles.addToListTopRight} delayPressIn={0} onPress={handleActionPress}>
               <Animated.View style={{ transform: [{ scale: iconScale }] }}>
                 <Ionicons name={isHistory && !inList ? "trash-outline" : (inList ? "checkmark-circle" : "add-circle")} size={32} color={isHistory && !inList ? "#e51c23" : (inList ? theme.primary : "#fff")} style={styles.iconDropShadow} />
               </Animated.View>
            </TouchableOpacity>
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']} style={styles.cardGradientBottom}>
              <Text style={styles.cardOverlayTitle} numberOfLines={2}>{item.title || item.name}</Text>
            </LinearGradient>
          </Animated.View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

// ============================================================================
// 2. MAIN LIBRARY SCREEN
// ============================================================================
export default function LibraryScreen() {
  const { theme, isDarkMode } = useContext(ThemeContext);
  const { watchlist, history } = useContext(LibraryContext);
  
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState('watchlist'); 
  const [latestUpdates, setLatestUpdates] = useState([]);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [tappedCardId, setTappedCardId] = useState(null);

  const isTabletLandscape = width >= 768 && width > height;
  const availableWidth = isTabletLandscape ? (width - 250) : width;
  const contentWidth = availableWidth - (SIZES.padding * 2);
  const idealWidth = 115;
  const gridSpacing = 10;
  const numColumns = Math.max(3, Math.floor((contentWidth + gridSpacing) / (idealWidth + gridSpacing)));
  const itemWidth = Math.floor((contentWidth - (gridSpacing * (numColumns - 1))) / numColumns);

  // 🔥 Mirrored exactly from HomeScreen
  const navigateToDetails = useCallback((id, media_type) => {
    const type = media_type || (id > 100000 ? 'movie' : 'tv');
    setTappedCardId(null);
    navigation.navigate('Details', { id, type }); 
  }, [navigation]);

  const fetchLatestUpdates = async () => {
    setLoadingLatest(true);
    try {
      if (watchlist.length === 0) {
        setLatestUpdates([]);
        setLoadingLatest(false);
        return;
      }

      const updates = [];
      const today = new Date();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(today.getMonth() - 1);

      await Promise.all(watchlist.map(async (item) => {
        try {
          // 🔥 Extractor applied here as well to ensure Latest accurately filters movies vs TV
          const rawType = item.media_type || item.type || item.mediaType;
          const mediaType = rawType ? String(rawType).toLowerCase() : (item.name || item.first_air_date ? 'tv' : 'movie');
          
          if (mediaType === 'movie') {
             if (item.release_date && new Date(item.release_date) > today) {
                 updates.push({ 
                     ...item, 
                     latest_update_text: "Coming Soon", 
                     sort_date: new Date(item.release_date).getTime() 
                 });
             }
             return;
          }

          if (mediaType === 'tv') {
              const res = await fetch(`${BASE_URL}/tv/${item.id}?api_key=${API_KEY}`);
              const details = await res.json();
              if (!details) return;

              let isAdded = false;

              if (details.next_episode_to_air && new Date(details.next_episode_to_air.air_date) > today) {
                  updates.push({ 
                      ...item, 
                      latest_update_text: "Coming Soon", 
                      sort_date: new Date(details.next_episode_to_air.air_date).getTime() 
                  });
                  isAdded = true;
              }

              if (!isAdded && details.last_air_date) {
                  const lastAirDate = new Date(details.last_air_date);
                  if (lastAirDate >= oneMonthAgo) {
                      let bannerText = "New Episode";
                      if (details.last_episode_to_air?.episode_number === 1) {
                          bannerText = "New Season";
                      }
                      updates.push({ 
                          ...item, 
                          latest_update_text: bannerText, 
                          sort_date: lastAirDate.getTime() 
                      });
                  }
              }
          }
        } catch (e) { }
      }));

      updates.sort((a, b) => b.sort_date - a.sort_date);
      setLatestUpdates(updates);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingLatest(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'latest') fetchLatestUpdates();
  }, [activeTab, watchlist]);

  let displayData = [];
  if (activeTab === 'watchlist') displayData = watchlist;
  else if (activeTab === 'history') displayData = history;
  else if (activeTab === 'latest') displayData = latestUpdates;

  const renderPill = (id, label, icon) => {
    const isActive = activeTab === id;
    return (
      <TouchableOpacity 
        style={[
          styles.pillBtn, 
          { backgroundColor: isActive ? (isDarkMode ? '#fff' : '#000') : (isDarkMode ? '#222' : '#e5e5e5') }
        ]}
        onPress={() => { 
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setActiveTab(id); 
          setTappedCardId(null); 
        }}
        activeOpacity={0.8}
      >
        <Ionicons 
          name={icon} 
          size={16} 
          color={isActive ? (isDarkMode ? '#000' : '#fff') : theme.text} 
          style={{ marginRight: 8 }} 
        />
        <Text style={[
          styles.pillText, 
          { color: isActive ? (isDarkMode ? '#000' : '#fff') : theme.text, fontWeight: isActive ? 'bold' : '600' }
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    let icon, title, subtitle;
    if (activeTab === 'watchlist') {
      icon = 'bookmark-outline';
      title = 'Your watchlist is empty';
      subtitle = 'Save movies and shows to watch later';
    } else if (activeTab === 'history') {
      icon = 'time-outline';
      title = 'Your history is empty';
      subtitle = 'Content you watch will appear here';
    } else {
      icon = 'notifications-outline';
      title = 'No recent updates';
      subtitle = 'Add active TV shows to your watchlist to see new episodes here';
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name={icon} size={80} color={theme.textSecondary} style={{ marginBottom: 15, opacity: 0.5 }} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={{ paddingBottom: 25 }}>
      <Text style={[styles.mainTitle, { color: theme.text }]}>My Library</Text>
      <Text style={[styles.subTitle, { color: theme.textSecondary }]}>Your saved content</Text>

      <View style={styles.pillsContainer}>
        {renderPill('watchlist', 'Watchlist', 'bookmark-outline')}
        {renderPill('history', 'History', 'time-outline')}
        {renderPill('latest', 'Latest', 'notifications-outline')}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 20) }]}>
      
      {activeTab === 'latest' && loadingLatest ? (
        <View style={{ flex: 1, paddingHorizontal: SIZES.padding }}>
          {renderHeader()}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        </View>
      ) : displayData.length === 0 ? (
        <View style={{ flex: 1, paddingHorizontal: SIZES.padding }}>
          {renderHeader()}
          {renderEmptyState()}
        </View>
      ) : (
        <FlatList
          key={`${numColumns}-${width}-${activeTab}`}
          data={displayData}
          keyExtractor={(item) => item.id.toString()}
          numColumns={numColumns}
          ListHeaderComponent={renderHeader()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SIZES.padding, paddingBottom: 100 }}
          columnWrapperStyle={{ gap: gridSpacing, marginBottom: gridSpacing }}
          onScrollBeginDrag={() => setTappedCardId(null)}
          removeClippedSubviews={false} 
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={5}
          renderItem={({ item }) => (
            <LibraryCard 
              item={item} 
              itemWidth={itemWidth} 
              theme={theme} 
              navigateToDetails={navigateToDetails}
              tappedCardId={tappedCardId}
              setTappedCardId={setTappedCardId}
              isHistory={activeTab === 'history'}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },

  mainTitle: { fontSize: 32, fontWeight: '900', marginBottom: 5 },
  subTitle: { fontSize: 16, fontWeight: '500', marginBottom: 20 },

  pillsContainer: { flexDirection: 'row', gap: 12 },
  pillBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 25 },
  pillText: { fontSize: 14 },

  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingBottom: 100 
  },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', maxWidth: 250 },

  cardWrapper: { position: 'relative' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 },
  bannerTag: { position: 'absolute', top: 10, left: 0, paddingHorizontal: 6, paddingVertical: 3, borderTopRightRadius: 4, borderBottomRightRadius: 4, zIndex: 5 },
  bannerText: { color: '#fff', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' },
  overlayBase: { overflow: 'hidden', zIndex: 10, borderRadius: 8 },
  addToListTopRight: { position: 'absolute', top: 6, right: 6, zIndex: 20 },
  iconDropShadow: { textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  cardGradientBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, paddingTop: 30, justifyContent: 'flex-end' },
  cardOverlayTitle: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
});