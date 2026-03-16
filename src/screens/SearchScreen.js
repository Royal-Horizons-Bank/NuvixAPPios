// src/screens/SearchScreen.js
import React, { useState, useEffect, useContext, useCallback, useRef, memo } from 'react';
import { 
  View, Text, StyleSheet, TextInput, FlatList, Image, ScrollView,
  TouchableOpacity, ActivityIndicator, Keyboard, Animated, useWindowDimensions, Modal, Alert, Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeContext } from '../context/ThemeContext';
import { LibraryContext } from '../context/LibraryContext';
import { SIZES } from '../constants/theme';

const API_KEY = "55550670b2e9a6b8c3c3c69b0bdf894f";
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";

// ============================================================================
// EXTRACTED SEARCH CARD (🔥 Fixed with Staggered Fetching)
// ============================================================================
const SearchCard = memo(({ item, itemWidth, theme, navigation, tappedCardId, setTappedCardId }) => {
  const isTapped = tappedCardId === item.id;
  const [hasMounted, setHasMounted] = useState(false);
  const [bannerText, setBannerText] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(1)).current;

  const { toggleWatchlist, isInWatchlist } = useContext(LibraryContext);
  const inList = isInWatchlist(item.id);

  const itemHeight = itemWidth * 1.5; 
  const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');

  useEffect(() => {
    let isMounted = true;
    let timeoutId;

    const checkBannerStatus = () => {
      if (item.release_date && new Date(item.release_date) > new Date()) {
        if (isMounted) setBannerText("Coming Soon");
        return;
      }
      if (item.first_air_date || item.media_type === 'tv') {
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
    };
    
    checkBannerStatus();
    
    return () => { 
      isMounted = false; 
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [item.id, item.release_date, item.first_air_date, item.media_type]);

  useEffect(() => {
    if (isTapped) {
      setHasMounted(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 80, useNativeDriver: true }).start();
    } else if (hasMounted) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [isTapped]);

  const handlePressIn = () => Animated.timing(cardScale, { toValue: 0.96, duration: 60, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(cardScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();

  const handlePress = () => {
    if (isTapped) {
      setTappedCardId(null);
      navigation.navigate('Details', { id: item.id, type: mediaType });
    } else {
      Animated.sequence([
        Animated.timing(cardScale, { toValue: 0.95, duration: 60, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true })
      ]).start();
      setTappedCardId(item.id); 
    }
  };

  const handleWatchlistPress = () => {
    Animated.sequence([
      Animated.timing(iconScale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true })
    ]).start();
    toggleWatchlist(item);
    setTimeout(() => setTappedCardId(null), 300); 
  };

  if (!item.poster_path) return null;

  return (
    <TouchableOpacity activeOpacity={1} delayPressIn={0} onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handlePress} style={{ width: itemWidth, height: itemHeight }}>
      <Animated.View style={[styles.cardWrapper, { width: '100%', height: '100%', transform: [{ scale: cardScale }] }]}>
        <Image source={{ uri: `${IMG_BASE}${item.poster_path}` }} style={[styles.cardImage, { borderColor: theme.border }]} />
        {bannerText && (
          <View style={[styles.bannerTag, { backgroundColor: theme.primary }]}>
            <Text style={styles.bannerText}>{bannerText}</Text>
          </View>
        )}
        {hasMounted && (
          <Animated.View pointerEvents={isTapped ? "auto" : "none"} style={[StyleSheet.absoluteFillObject, styles.overlayBase, { opacity: fadeAnim }]}>
            <TouchableOpacity style={styles.addToListTopRight} delayPressIn={0} onPress={handleWatchlistPress}>
               <Animated.View style={{ transform: [{ scale: iconScale }] }}>
                 <Ionicons name={inList ? "checkmark-circle" : "add-circle"} size={32} color={inList ? theme.primary : "#fff"} style={styles.iconDropShadow} />
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
// 2. MAIN SEARCH SCREEN
// ============================================================================
export default function SearchScreen() {
  const { theme } = useContext(ThemeContext);
  const navigation = useNavigation();
  const route = useRoute(); 
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ people: [], titles: [] }); 
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [tappedCardId, setTappedCardId] = useState(null);

  // --- RANDOMIZER ANIMATION STATE ---
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [randomMovie, setRandomMovie] = useState(null);
  
  const orbPulse = useRef(new Animated.Value(0)).current;
  const orbSpin = useRef(new Animated.Value(0)).current; 
  const posterScale = useRef(new Animated.Value(0.1)).current;
  const posterOpacity = useRef(new Animated.Value(0)).current;
  const posterRotateY = useRef(new Animated.Value(0)).current; 

  const isTabletLandscape = width >= 768 && width > height;
  const availableWidth = isTabletLandscape ? (width - 250) : width;
  const contentWidth = availableWidth - (SIZES.padding * 2);

  const idealWidth = 115;
  const gridSpacing = 10;
  
  const numColumns = Math.max(3, Math.floor((contentWidth + gridSpacing) / (idealWidth + gridSpacing)));
  const itemWidth = Math.floor((contentWidth - (gridSpacing * (numColumns - 1))) / numColumns);

  useEffect(() => {
    if (route.params?.query) {
      setQuery(route.params.query);
      Keyboard.dismiss(); 
      navigation.setParams({ query: undefined }); 
    }
  }, [route.params?.query]);

  const fetchTrending = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/trending/all/day?api_key=${API_KEY}`);
      const data = await res.json();
      const validItems = data.results.filter(i => i.poster_path);
      setResults({ people: [], titles: validItems });
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  const fetchSearchResults = async (searchQuery) => {
    setLoading(true);
    try {
      const lowerQuery = searchQuery.toLowerCase().trim();
      
      const [res1, res2] = await Promise.all([
        fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(searchQuery)}&include_adult=false&page=1`),
        fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(searchQuery)}&include_adult=false&page=2`)
      ]);
      
      const data1 = await res1.json();
      const data2 = await res2.json();
      const rawResults = [...(data1.results || []), ...(data2.results || [])];
      
      const people = [];
      const titles = [];
      const seenIds = new Set();
      
      let topPerson = null;

      rawResults.forEach(item => {
        if (item.media_type === 'person') {
           if (item.profile_path) {
               people.push(item);
               if (!topPerson && item.name.toLowerCase().includes(lowerQuery)) {
                   topPerson = item;
               }
           }
        } else {
           if (item.poster_path && !seenIds.has(item.id)) {
               item.relevanceScore = (item.title || item.name || '').toLowerCase().includes(lowerQuery) ? 10 : 5;
               titles.push(item);
               seenIds.add(item.id);
           }
        }
      });

      if (topPerson) {
          try {
              const credRes = await fetch(`${BASE_URL}/person/${topPerson.id}/combined_credits?api_key=${API_KEY}`);
              const credData = await credRes.json();
              if (credData.cast) {
                  credData.cast.forEach(work => {
                      if (work.poster_path && !seenIds.has(work.id)) {
                          work.relevanceScore = 20; 
                          titles.push(work);
                          seenIds.add(work.id);
                      }
                  });
              }
          } catch (err) {
              console.error("Failed to fetch actor's full credits", err);
          }
      }
      
      titles.sort((a, b) => {
          const scoreA = a.relevanceScore || 0;
          const scoreB = b.relevanceScore || 0;
          if (scoreA !== scoreB) return scoreB - scoreA; 
          return (b.popularity || 0) - (a.popularity || 0); 
      });

      setResults({ people, titles });
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!query.trim()) {
      fetchTrending();
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      fetchSearchResults(query);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // ============================================================================
  // RANDOMIZER ANIMATION LOGIC
  // ============================================================================
  const startRandomizer = async () => {
    Keyboard.dismiss();
    setIsRandomizing(true);
    setRandomMovie(null);
    
    orbPulse.setValue(0);
    orbSpin.setValue(0);
    posterScale.setValue(0.1);
    posterOpacity.setValue(0);
    posterRotateY.setValue(0);

    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(orbPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(orbPulse, { toValue: 0, duration: 400, useNativeDriver: true })
        ]),
        Animated.timing(orbSpin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })
      ])
    ).start();

    try {
      const initialRes = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=popularity.desc&vote_count.gte=500&language=en-US`);
      const initialData = await initialRes.json();
      const totalPages = Math.min(initialData.total_pages, 500); 

      const skewedRandom = Math.random() * Math.random();
      const randomPage = Math.floor(skewedRandom * totalPages) + 1;

      const pageRes = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=popularity.desc&vote_count.gte=500&page=${randomPage}`);
      const pageData = await pageRes.json();
      const validMovies = pageData.results?.filter(m => m.poster_path && m.title) || [];

      if (validMovies.length > 0) {
        const picked = validMovies[Math.floor(Math.random() * validMovies.length)];
        
        setTimeout(() => {
            setRandomMovie(picked);
            
            Animated.parallel([
                Animated.spring(posterScale, { toValue: 1, tension: 40, friction: 6, useNativeDriver: true }),
                Animated.timing(posterOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
                Animated.spring(posterRotateY, { toValue: 1, tension: 30, friction: 7, useNativeDriver: true })
            ]).start();

            setTimeout(() => {
                setIsRandomizing(false);
                navigation.navigate('Details', { id: picked.id, type: 'movie' });
            }, 3500);

        }, 2200);
      } else {
        setIsRandomizing(false);
        Alert.alert("Oops", "The Randomizer came up empty. Please try again!");
      }
    } catch (error) {
      setIsRandomizing(false);
      console.error("Randomizer Error:", error);
    }
  };

  const renderHeader = () => (
    <View style={{ paddingBottom: 15 }}>
      {results.people.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>People</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {results.people.map(person => (
              <TouchableOpacity 
                key={person.id} 
                style={styles.personContainer} 
                onPress={() => { setQuery(person.name); Keyboard.dismiss(); }}
              >
                <Image source={{ uri: `${IMG_BASE}${person.profile_path}` }} style={[styles.personPic, { borderColor: theme.border }]} />
                <Text style={[styles.personName, { color: theme.text }]} numberOfLines={2}>{person.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
        {query.trim().length > 0 ? 'Search Results' : 'Trending Now'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 15) }]}>
      
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SIZES.padding, paddingBottom: 5 }}>
        <TouchableOpacity 
          onPress={startRandomizer} 
          style={[styles.diceButton, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]}
        >
          <Ionicons name="dice" size={26} color={theme.text} />
        </TouchableOpacity>

        <View style={[styles.searchBox, { flex: 1, backgroundColor: theme.surfaceGlass, borderColor: isFocused ? theme.primary : theme.border }]}>
          <Ionicons name="search" size={20} color={isFocused ? theme.primary : theme.textSecondary} style={{ marginRight: 10 }} />
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Search movies, shows, or actors..."
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); Keyboard.dismiss(); }}>
              <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (results.titles.length === 0 && results.people.length === 0) ? (
        <View style={styles.centerContainer}>
          <Ionicons name="film-outline" size={60} color={theme.border} style={{ marginBottom: 15 }} />
          <Text style={{ color: theme.textSecondary, fontSize: 16 }}>No results found for "{query}"</Text>
        </View>
      ) : (
        <FlatList
          key={`${numColumns}-${width}`} 
          data={results.titles}
          extraData={tappedCardId} 
          keyExtractor={(item) => item.id.toString()}
          numColumns={numColumns}
          ListHeaderComponent={renderHeader}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SIZES.padding, paddingBottom: 100, paddingTop: 15 }}
          columnWrapperStyle={{ gap: gridSpacing, marginBottom: gridSpacing }}
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={() => setTappedCardId(null)}
          initialNumToRender={15}
          windowSize={5}
          renderItem={({ item }) => (
            <SearchCard 
              item={item} 
              itemWidth={itemWidth} 
              theme={theme} 
              navigation={navigation}
              tappedCardId={tappedCardId}
              setTappedCardId={setTappedCardId}
            />
          )}
        />
      )}

      {/* ============================================================================ */}
      {/* RANDOMIZER ANIMATION OVERLAY */}
      {/* ============================================================================ */}
      <Modal visible={isRandomizing} transparent animationType="fade">
        <View style={styles.randomizerOverlay}>
           {!randomMovie ? (
              <View style={styles.orbContainer}>
                 <Animated.View style={[
                    styles.orb, 
                    { 
                      backgroundColor: theme.primary, 
                      shadowColor: theme.primary,
                      transform: [
                        { scale: orbPulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.4] }) },
                        { rotate: orbSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }
                      ],
                      opacity: orbPulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] })
                    }
                 ]}>
                    <Ionicons name="dice" size={50} color="#fff" />
                 </Animated.View>
                 <Text style={styles.randomizerTitle}>Rolling the cinematic dice...</Text>
                 <Text style={styles.randomizerSubtitle}>Searching the cosmos</Text>
              </View>
           ) : (
              <Animated.View style={[
                  styles.winnerContainer, 
                  { 
                    opacity: posterOpacity, 
                    transform: [
                      { scale: posterScale },
                      { rotateY: posterRotateY.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '0deg'] }) }
                    ] 
                  }
              ]}>
                 <Text style={styles.winnerHeader}>The Dice has chosen!</Text>
                 <Image source={{ uri: `${IMG_BASE}${randomMovie.poster_path}` }} style={[styles.winnerImage, { borderColor: theme.primary }]} />
              </Animated.View>
           )}
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  diceButton: { marginRight: 10, padding: 10, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 25, paddingHorizontal: 15, borderWidth: 1 },
  input: { flex: 1, fontSize: 16, fontWeight: '500', height: '100%' },
  
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },

  sectionHeader: { fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 },
  
  personContainer: { width: 80, alignItems: 'center', marginRight: 15 },
  personPic: { width: 70, height: 70, borderRadius: 35, borderWidth: 1, marginBottom: 8, backgroundColor: '#333' },
  personName: { fontSize: 12, textAlign: 'center', fontWeight: '600' },

  cardWrapper: { position: 'relative' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 },
  bannerTag: { position: 'absolute', top: 10, left: 0, paddingHorizontal: 6, paddingVertical: 3, borderTopRightRadius: 4, borderBottomRightRadius: 4, zIndex: 5 },
  bannerText: { color: '#fff', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' },
  overlayBase: { overflow: 'hidden', zIndex: 10, borderRadius: 8 },
  addToListTopRight: { position: 'absolute', top: 6, right: 6, zIndex: 20 },
  iconDropShadow: { textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  cardGradientBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, paddingTop: 30, justifyContent: 'flex-end' },
  cardOverlayTitle: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  randomizerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  orbContainer: { alignItems: 'center', justifyContent: 'center' },
  orb: { width: 90, height: 90, borderRadius: 45, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 40, elevation: 20, marginBottom: 50, justifyContent: 'center', alignItems: 'center' },
  randomizerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 30, marginBottom: 10 },
  randomizerSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontStyle: 'italic' },
  
  winnerContainer: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  winnerHeader: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 25, textTransform: 'uppercase', letterSpacing: 1 },
  winnerImage: { width: 220, height: 330, borderRadius: 16, borderWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.8, shadowRadius: 20 },
});