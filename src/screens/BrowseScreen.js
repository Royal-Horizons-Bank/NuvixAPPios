// src/screens/BrowseScreen.js
import React, { useState, useEffect, useContext, useCallback, useRef, memo } from 'react';
import { 
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, 
  ActivityIndicator, Animated, useWindowDimensions 
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
const IMG_BASE = "https://image.tmdb.org/t/p/w342";

const getGenreGradient = (genreName) => {
  const name = genreName.toLowerCase();
  if (name.includes('action')) return ['#FF416C', '#FF4B2B']; 
  if (name.includes('comedy')) return ['#F2994A', '#F2C94C']; 
  if (name.includes('sci-fi') || name.includes('science')) return ['#00B4DB', '#0083B0']; 
  if (name.includes('horror') || name.includes('thriller')) return ['#141E30', '#243B55']; 
  if (name.includes('romance') || name.includes('drama')) return ['#bc4e9c', '#f80759']; 
  if (name.includes('fantasy') || name.includes('animation') || name.includes('music')) return ['#8E2DE2', '#4A00E0']; 
  if (name.includes('crime') || name.includes('mystery')) return ['#3a7bd5', '#3a6073']; 
  if (name.includes('adventure') || name.includes('history') || name.includes('war')) return ['#654ea3', '#eaafc8']; 
  if (name.includes('family')) return ['#11998E', '#38EF7D']; 
  return ['#4B79A1', '#283E51']; 
};

const getGenreIcon = (genreName) => {
  const name = genreName.toLowerCase();
  if (name.includes('action')) return 'flame';
  if (name.includes('comedy')) return 'happy';
  if (name.includes('drama')) return 'film';
  if (name.includes('romance')) return 'heart';
  if (name.includes('horror')) return 'skull';
  if (name.includes('fantasy')) return 'color-wand';
  if (name.includes('sci-fi') || name.includes('science')) return 'planet';
  if (name.includes('adventure')) return 'compass';
  if (name.includes('animation')) return 'color-palette';
  if (name.includes('crime')) return 'shield-checkmark';
  if (name.includes('documentary')) return 'videocam';
  if (name.includes('family')) return 'people';
  if (name.includes('history')) return 'library';
  if (name.includes('music')) return 'musical-notes';
  if (name.includes('mystery')) return 'search';
  if (name.includes('thriller')) return 'eye';
  if (name.includes('war')) return 'medal';
  if (name.includes('western')) return 'star';
  return 'grid'; 
};

// ============================================================================
// BROWSE CARD COMPONENT (🔥 Fixed with Staggered Fetching)
// ============================================================================
const BrowseCard = memo(({ item, itemWidth, theme, navigation, tappedCardId, setTappedCardId }) => {
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

export default function BrowseScreen() {
  const { theme } = useContext(ThemeContext);
  const navigation = useNavigation();
  const route = useRoute(); 
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [genres, setGenres] = useState([]);
  const [activeGenre, setActiveGenre] = useState(null);
  const [movies, setMovies] = useState([]);
  
  const [loadingGenres, setLoadingGenres] = useState(true);
  const [loadingMovies, setLoadingMovies] = useState(false);
  const [tappedCardId, setTappedCardId] = useState(null);

  const isTabletLandscape = width >= 768 && width > height;
  const availableWidth = isTabletLandscape ? (width - 250) : width;
  const contentWidth = availableWidth - (SIZES.padding * 2);
  const idealWidth = 115;
  const gridSpacing = 10;
  
  const numColumns = Math.max(3, Math.floor((contentWidth + gridSpacing) / (idealWidth + gridSpacing)));
  const itemWidth = Math.floor((contentWidth - (gridSpacing * (numColumns - 1))) / numColumns);

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const res = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`);
        const data = await res.json();
        const fetchedGenres = data.genres || [];
        setGenres(fetchedGenres);
        
        if (fetchedGenres.length > 0) {
          const initialId = route.params?.selectedGenreId;
          const matched = initialId ? fetchedGenres.find(g => g.id === initialId) : null;
          setActiveGenre(matched || fetchedGenres[0]);
        }
      } catch (error) { console.error(error); }
      finally { setLoadingGenres(false); }
    };
    fetchGenres();
  }, []); 

  useEffect(() => {
    if (route.params?.selectedGenreId && genres.length > 0) {
      const matched = genres.find(g => g.id === route.params.selectedGenreId);
      if (matched && activeGenre?.id !== matched.id) {
        setActiveGenre(matched);
        setTappedCardId(null);
      }
    }
  }, [route.params?.selectedGenreId, genres]);


  useEffect(() => {
    if (!activeGenre) return;
    const fetchMoviesByGenre = async () => {
      setLoadingMovies(true);
      try {
        const pagesToFetch = [1, 2, 3, 4].map(page => 
          fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${activeGenre.id}&sort_by=popularity.desc&page=${page}`).then(res => res.json())
        );
        
        const results = await Promise.all(pagesToFetch);
        const combined = results.flatMap(data => data.results || []);
        
        const validMovies = combined.filter(m => m.poster_path);
        const unique = Array.from(new Map(validMovies.map(item => [item.id, item])).values());
        
        setMovies(unique);
      } catch (error) { console.error(error); }
      finally { setLoadingMovies(false); }
    };
    fetchMoviesByGenre();
  }, [activeGenre]);

  const renderHeader = () => (
    <View style={{ paddingBottom: 15 }}>
      <Text style={[styles.mainTitle, { color: theme.text }]}>Browse</Text>
      <Text style={[styles.subTitle, { color: theme.textSecondary }]}>Discover movies by genre</Text>

      {loadingGenres ? (
        <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          horizontal showsHorizontalScrollIndicator={false} data={genres}
          keyExtractor={(item) => item.id.toString()} contentContainerStyle={{ paddingVertical: 20 }}
          snapToInterval={110} snapToAlignment="start" decelerationRate="fast"
          renderItem={({ item }) => {
            const isActive = activeGenre?.id === item.id;
            const gradientColors = getGenreGradient(item.name);
            const iconName = getGenreIcon(item.name);

            return (
              <TouchableOpacity activeOpacity={0.8} onPress={() => { setActiveGenre(item); setTappedCardId(null); }}>
                <LinearGradient 
                  colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[styles.genreCard, isActive ? { borderWidth: 2, borderColor: '#fff' } : { borderWidth: 1, borderColor: theme.border }]}
                >
                  <Ionicons name={iconName} size={28} color="#fff" style={{ marginBottom: 8 }} />
                  <Text style={styles.genreCardText}>{item.name}</Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {activeGenre && (
        <View style={styles.activeGenreRow}>
          <LinearGradient colors={getGenreGradient(activeGenre.name)} style={styles.activeGenreIconBg}>
            <Ionicons name={getGenreIcon(activeGenre.name)} size={18} color="#fff" />
          </LinearGradient>
          <Text style={[styles.activeGenreTitle, { color: theme.text }]}>{activeGenre.name} Movies</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 15) }]}>
      {loadingMovies && movies.length === 0 ? (
        <View style={{ flex: 1 }}>
          {renderHeader()}
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        </View>
      ) : (
        <FlatList
          key={`${numColumns}-${width}`} 
          data={movies} keyExtractor={(item) => item.id.toString()} numColumns={numColumns}
          ListHeaderComponent={renderHeader()}
          showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SIZES.padding, paddingBottom: 100 }}
          columnWrapperStyle={{ gap: gridSpacing, marginBottom: gridSpacing }}
          onScrollBeginDrag={() => setTappedCardId(null)}
          removeClippedSubviews={true} initialNumToRender={12} maxToRenderPerBatch={8} updateCellsBatchingPeriod={50} windowSize={5}
          renderItem={({ item }) => (
            <BrowseCard 
              item={item} itemWidth={itemWidth} theme={theme} navigation={navigation}
              tappedCardId={tappedCardId} setTappedCardId={setTappedCardId}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },

  mainTitle: { fontSize: 32, fontWeight: '900', marginBottom: 5 },
  subTitle: { fontSize: 16, fontWeight: '500', marginBottom: 10 },

  genreCard: { width: 100, height: 110, borderRadius: 12, marginRight: 10, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  genreCardText: { color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center' },

  activeGenreRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 20 },
  activeGenreIconBg: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  activeGenreTitle: { fontSize: 22, fontWeight: 'bold' },

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