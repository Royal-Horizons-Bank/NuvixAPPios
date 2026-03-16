// src/screens/DetailsScreen.js
import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, 
  ActivityIndicator, useWindowDimensions, FlatList, Share, Alert, Platform, Dimensions, Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview'; 
import * as ScreenOrientation from 'expo-screen-orientation';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { ThemeContext } from '../context/ThemeContext';
import { LibraryContext } from '../context/LibraryContext'; 
import { SIZES } from '../constants/theme';

const API_KEY = "55550670b2e9a6b8c3c3c69b0bdf894f";
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/";

const watchSources = [
  { name: "Nuvix-Go", movieUrl: "https://gomovies-sx.net/embed/movie/{imdb_id}?autoplay=1", tvUrl: "https://gomovies-sx.net/embed/tv/{imdb_id}/{season}/{episode}?" },
  { name: "Nuvix-Core", movieUrl: "https://vidsrc.cc/v2/embed/movie/{imdb_id}?autoplay=1", tvUrl: "https://vidsrc.cc/v2/embed/tv/{imdb_id}/{season}/{episode}" },
  { name: "Nuvix-Anime", tvUrl: "https://vidsrc.cc/v2/embed/anime/{imdb_id}/{episode}/sub" },
  { name: "Nuvix-Prime", movieUrl: "https://vidsrc-embed.ru/embed/movie?imdb={imdb_id}", tvUrl: "https://vidsrc.xyz/embed/tv?imdb={imdb_id}&season={season}&episode={episode}" },
  { name: "Nuvix-Relay", movieUrl: "https://vidsrcme.su/embed/movie/{imdb_id}", tvUrl: "https://vidsrc.to/embed/tv/{imdb_id}/{season}/{episode}" },
  { name: "Nuvix-Nexus", movieUrl: "https://www.2embed.cc/embed/{imdb_id}", tvUrl: "https://www.2embed.cc/embedtv/{imdb_id}/s-{season}-e-{episode}" },
  { name: "Nuvix-backup", movieUrl: "https://multiembed.mov/?video_id={imdb_id}&tmdb=1", tvUrl: "https://multiembed.mov/?video_id={imdb_id}&s={season}&e={episode}" }
];

const injectedTrackingJS = `
  setInterval(function() {
    try {
      var v = document.querySelector('video') || document.querySelector('iframe').contentWindow.document.querySelector('video');
      if (v && v.duration) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress',
          currentTime: v.currentTime,
          duration: v.duration
        }));
      }
    } catch(e) {}
  }, 10000);
  true;
`;

export default function DetailsScreen() {
  const { theme, isDarkMode } = useContext(ThemeContext);
  const { toggleWatchlist, isInWatchlist, addToHistory, watchlist, history } = useContext(LibraryContext); 
  
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768; 
  
  const { id, type, autoPlaySeason, autoPlayEpisode } = route.params;
  const scrollViewRef = useRef(null);

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [collectionData, setCollectionData] = useState([]);
  const [similarData, setSimilarData] = useState([]);
  const [activeTab, setActiveTab] = useState('similar');

  const [activeMediaUrl, setActiveMediaUrl] = useState(null);
  const [selectedServerIndex, setSelectedServerIndex] = useState(0); 
  
  const [selectedSeason, setSelectedSeason] = useState(autoPlaySeason || 1);
  const [currentPlayingEpisode, setCurrentPlayingEpisode] = useState(autoPlayEpisode || null); 
  
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [currentCast, setCurrentCast] = useState([]);

  const [progressData, setProgressData] = useState({});
  const progressRef = useRef({});
  const playStartTimeRef = useRef(null);
  const hasSyncedHistoryRef = useRef(false);

  const listIconScale = useRef(new Animated.Value(1)).current;
  const inList = details ? isInWatchlist(details.id) : false;

  useFocusEffect(
    React.useCallback(() => {
      ScreenOrientation.unlockAsync();
      return () => {
        const dim = Dimensions.get('window');
        const tabletCheck = Platform.OS === 'ios' ? Platform.isPad : Math.min(dim.width, dim.height) >= 600;
        if (!tabletCheck && Platform.OS !== 'web') ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      };
    }, [])
  );

  // Cross-device Progress Syncing
  useEffect(() => {
    const loadProgress = async () => {
      try {
        let parsed = {};
        
        // Load local progress first
        const stored = await AsyncStorage.getItem(`nuvix_prog_${id}`);
        if (stored) {
            parsed = JSON.parse(stored);
        }
        
        // If history is loaded, merge any cloud progress over the local progress
        if (!hasSyncedHistoryRef.current && history.length > 0) {
            const historyItem = history.find(item => item.id === id);
            if (historyItem && historyItem.progressMap) {
                parsed = { ...parsed, ...historyItem.progressMap };
                AsyncStorage.setItem(`nuvix_prog_${id}`, JSON.stringify(parsed));
                hasSyncedHistoryRef.current = true;
            }
        }

        setProgressData(parsed);
        progressRef.current = parsed;
      } catch (e) { console.log(e); }
    };
    loadProgress();
  }, [id, history.length]);

  const calculateAndSaveTime = (epNum) => {
    if (!playStartTimeRef.current) return null;
    
    const timeSpentMinutes = (Date.now() - playStartTimeRef.current) / 60000;
    let epRuntime = type === 'movie' ? (details?.runtime || 120) : (episodes.find(e => e.episode_number === epNum)?.runtime || 45);
    
    const key = type === 'movie' ? '1-1' : `${selectedSeason}-${epNum}`;
    const currentProg = progressRef.current[key] || 0;
    
    if (currentProg >= 0.95) return currentProg; 
    
    let newProg = currentProg + (timeSpentMinutes / epRuntime);
    if (newProg >= 0.85 || timeSpentMinutes > epRuntime * 0.85) newProg = 1.0;
    newProg = Math.min(newProg, 1.0);
    
    if (newProg > currentProg && newProg > 0.01) { 
        const updated = { ...progressRef.current, [key]: newProg };
        setProgressData(updated);
        progressRef.current = updated;
        AsyncStorage.setItem(`nuvix_prog_${id}`, JSON.stringify(updated));
        return newProg;
    }
    return currentProg;
  };

  const syncProgressToContext = (epNum, progValue) => {
    if (!details) return;
    const exactEpisode = type === 'tv' ? episodes.find(e => e.episode_number === epNum) : null;

    const liteItem = {
      id: details.id,
      title: details.title || null,
      name: details.name || null,
      poster_path: details.poster_path || null,
      backdrop_path: details.backdrop_path || null,
      vote_average: details.vote_average || 0,
      release_date: details.release_date || null,
      first_air_date: details.first_air_date || null,
      media_type: type, 
      overview: details.overview || "",
      episode_still_path: exactEpisode?.still_path || null,
      last_watched_season: type === 'tv' ? selectedSeason : null,
      last_watched_episode: type === 'tv' ? epNum : null,
      savedProgress: progValue,
      progressMap: progressRef.current 
    };
    addToHistory(liteItem);
  };

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=credits,recommendations,images,external_ids,videos&include_image_language=en,null`);
        const data = await res.json();
        
        data.media_type = type;
        setDetails(data);
        setCurrentCast(data.credits?.cast || []);

        let colParts = [];
        if (type === 'movie' && data.belongs_to_collection) {
          const colRes = await fetch(`${BASE_URL}/collection/${data.belongs_to_collection.id}?api_key=${API_KEY}`);
          const colData = await colRes.json();
          if (colData.parts) {
            colParts = colData.parts
              .sort((a, b) => new Date(a.release_date) - new Date(b.release_date))
              .filter(p => p.id !== id);
            
            setCollectionData(colParts);
            if (colParts.length > 0) setActiveTab('collection');
          }
        }

        const collectionIds = new Set(colParts.map(p => p.id));
        const filteredRecs = (data.recommendations?.results || []).filter(rec => !collectionIds.has(rec.id));
        setSimilarData(filteredRecs);

        if (type === 'tv') {
          const targetSeason = autoPlaySeason || data.seasons?.find(s => s.season_number > 0)?.season_number || 1;
          setSelectedSeason(targetSeason);
          fetchSeason(targetSeason, data); 
        }
      } catch (error) {
        console.error("Error fetching details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id, type]);

  const fetchSeason = async (seasonNumber, fallbackDetails = null) => {
    setLoadingEpisodes(true);
    try {
      const res = await fetch(`${BASE_URL}/tv/${id}/season/${seasonNumber}?api_key=${API_KEY}&append_to_response=credits`);
      const data = await res.json();
      setEpisodes(data.episodes || []);

      const sourceDetails = fallbackDetails || details;
      if (data.credits && data.credits.cast && data.credits.cast.length > 0) {
        setCurrentCast(data.credits.cast);
      } else if (sourceDetails && sourceDetails.credits?.cast) {
        setCurrentCast(sourceDetails.credits.cast);
      }

    } catch (error) {
      console.error("Error fetching season:", error);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const handleSeasonChange = (seasonNum) => {
    setSelectedSeason(seasonNum);
    fetchSeason(seasonNum);
  };

  const handlePlay = (episodeNumber = null, targetServer = selectedServerIndex) => {
    const epToPlay = episodeNumber || currentPlayingEpisode || 1;
    
    if (currentPlayingEpisode && currentPlayingEpisode !== epToPlay) {
      const finalProg = calculateAndSaveTime(currentPlayingEpisode);
      if (finalProg !== null) syncProgressToContext(currentPlayingEpisode, finalProg);
    }

    setCurrentPlayingEpisode(epToPlay);
    playStartTimeRef.current = Date.now(); 

    const key = type === 'movie' ? '1-1' : `${selectedSeason}-${epToPlay}`;
    const initialProg = progressRef.current[key] || 0.05; 
    syncProgressToContext(epToPlay, initialProg);

    const imdbId = details?.external_ids?.imdb_id;
    const targetId = imdbId || id; 
    const source = watchSources[targetServer];
    let url = '';

    if (type === 'movie') {
      if (!source.movieUrl) { Alert.alert("Server Error", "This server does not support movies."); return; }
      url = source.movieUrl.replace('{imdb_id}', targetId);
    } else {
      if (!source.tvUrl) { Alert.alert("Server Error", "This server does not support TV shows."); return; }
      url = source.tvUrl.replace('{imdb_id}', targetId).replace('{season}', selectedSeason).replace('{episode}', epToPlay);
    }

    const finalUrl = url.includes('?') ? `${url}&t=${new Date().getTime()}` : `${url}?t=${new Date().getTime()}`;
    setActiveMediaUrl(finalUrl);
    setTimeout(() => { scrollViewRef.current?.scrollTo({ y: 0, animated: true }); }, 100);
  };

  const handleServerSelect = (index) => {
    setSelectedServerIndex(index);
    if (activeMediaUrl && !activeMediaUrl.includes('kinocheck.com') && !activeMediaUrl.startsWith('youtube:')) {
      handlePlay(currentPlayingEpisode, index);
    }
  };

  const handlePlayTrailer = async () => {
    try {
      const kcEndpoint = type === 'tv' ? 'shows' : 'movies';
      const kcRes = await fetch(`https://api.kinocheck.com/${kcEndpoint}?tmdb_id=${id}&language=en`);
      
      if (kcRes.ok) {
        const kcData = await kcRes.json();
        if (kcData.trailer && kcData.trailer.url) {
          setActiveMediaUrl(kcData.trailer.url);
          setCurrentPlayingEpisode(null);
          setTimeout(() => { scrollViewRef.current?.scrollTo({ y: 0, animated: true }); }, 100);
          return; 
        }
      }
    } catch (e) { console.log("KinoCheck error, falling back to TMDB"); }

    const videos = details?.videos?.results || [];
    const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.find(v => v.site === 'YouTube');
    
    if (trailer) {
      setActiveMediaUrl(`youtube:${trailer.key}`);
      setCurrentPlayingEpisode(null);
      setTimeout(() => { scrollViewRef.current?.scrollTo({ y: 0, animated: true }); }, 100);
    } else {
      Alert.alert("No Trailer", "A trailer is not available for this title.");
    }
  };

  const handleToggleList = () => {
    Animated.sequence([
      Animated.timing(listIconScale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.spring(listIconScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true })
    ]).start();
    
    const existingItem = watchlist ? watchlist.find(i => i.id === details.id) : null;
    
    if (existingItem) {
        toggleWatchlist(existingItem);
    } else {
        const liteItem = {
            id: details.id,
            title: details.title || null,
            name: details.name || null,
            poster_path: details.poster_path || null,
            backdrop_path: details.backdrop_path || null,
            vote_average: details.vote_average || 0,
            release_date: details.release_date || null,
            first_air_date: details.first_air_date || null,
            media_type: type, 
            overview: details.overview || ""
        };
        toggleWatchlist(liteItem);
    }
  };

  const handleShare = async () => {
    const title = details.title || details.name;
    const shareUrl = `https://nuvix.fun/${type}/${id}`;
    try { 
      await Share.share({ message: `Watch ${title} right now on Nuvix!\n\n${shareUrl}`, url: shareUrl, title: `Check out ${title}` }); 
    } catch (error) { console.log(error); }
  };

  const handleUniversalClose = () => {
    if (currentPlayingEpisode || type === 'movie') {
        const epNum = currentPlayingEpisode || 1;
        const finalProg = calculateAndSaveTime(epNum);
        if (finalProg !== null) syncProgressToContext(epNum, finalProg);
    }
    setActiveMediaUrl(null);
    playStartTimeRef.current = null;
    navigation.popToTop(); 
  };

  const handleFullscreenUpdate = async (event) => {
    if (!isTablet && Platform.OS !== 'web') {
      if (event.nativeEvent.state === 1) {
        await ScreenOrientation.unlockAsync(); 
      } else if (event.nativeEvent.state === 3) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    }
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'progress' && data.duration > 0 && (currentPlayingEpisode || type === 'movie')) {
         let percentage = data.currentTime / data.duration;
         setProgressData(prev => {
            const key = type === 'movie' ? '1-1' : `${selectedSeason}-${currentPlayingEpisode}`;
            const currentProg = prev[key] || 0;
            if (currentProg >= 0.95) return prev; 
            
            if (percentage >= 0.85) percentage = 1.0;
            if (percentage > currentProg) {
                const updated = { ...prev, [key]: percentage };
                progressRef.current = updated;
                AsyncStorage.setItem(`nuvix_prog_${id}`, JSON.stringify(updated));
                return updated;
            }
            return prev;
         });
      }
    } catch(e) {}
  };

  if (loading || !details) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const logoObj = details.images?.logos?.find(l => l.iso_639_1 === 'en') || details.images?.logos?.[0];
  const releaseYear = (details.release_date || details.first_air_date || '').substring(0, 4);
  const duration = type === 'movie' 
    ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` 
    : `${details.number_of_seasons} Season${details.number_of_seasons > 1 ? 's' : ''}`;

  const gradientMiddle = isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
  const hasCollection = collectionData.length > 0;
  const hasSimilar = similarData.length > 0;
  const activeCarouselData = activeTab === 'collection' ? collectionData : similarData;
  const videoHeight = activeMediaUrl ? (isTablet ? (height * 0.6) : 300) : (isTablet ? 650 : 500);
  const isYouTube = activeMediaUrl?.startsWith('youtube:');
  const youtubeId = isYouTube ? activeMediaUrl.split(':')[1] : null;

  const movieProg = progressData['1-1'] || 0;
  const movieFinished = movieProg >= 0.95;
  const moviePartial = movieProg > 0 && movieProg < 0.95;

  // Dynamic Play / Resume Button Fix
  let mainPlayText = 'Play';
  if (type === 'movie') {
      mainPlayText = movieFinished ? 'Play Again' : moviePartial ? 'Resume' : 'Play';
  } else if (currentPlayingEpisode) {
      const epKey = `${selectedSeason}-${currentPlayingEpisode}`;
      const epProg = progressData[epKey] || 0;
      const epFinished = epProg >= 0.95;
      const epPartial = epProg > 0 && epProg < 0.95;

      if (epFinished) {
          mainPlayText = `Play S${selectedSeason} E${currentPlayingEpisode} Again`;
      } else if (epPartial) {
          mainPlayText = `Resume S${selectedSeason} E${currentPlayingEpisode}`;
      } else {
          mainPlayText = `Play S${selectedSeason} E${currentPlayingEpisode}`;
      }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView ref={scrollViewRef} bounces={false} showsVerticalScrollIndicator={false}>
        
        <View style={{ width: '100%', height: videoHeight, marginTop: activeMediaUrl ? insets.top : 0, backgroundColor: '#000', position: 'relative' }}>
          <TouchableOpacity style={[styles.backButton, { top: activeMediaUrl ? 10 : Math.max(insets.top, 20) }]} onPress={handleUniversalClose}>
            <Ionicons name="close" size={28} color="#fff" style={styles.iconDropShadow} />
          </TouchableOpacity>

          {activeMediaUrl ? (
            Platform.OS === 'web' ? (
              React.createElement('iframe', {
                src: isYouTube 
                  ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&playsinline=1&controls=1&modestbranding=1` 
                  : activeMediaUrl,
                style: { width: '100%', height: '100%', border: 'none', backgroundColor: '#000' },
                allowFullScreen: true,
                allow: "autoplay; fullscreen"
              })
            ) : (
              <WebView 
                source={
                  isYouTube 
                  ? { 
                      html: `
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                            <style>
                              body { margin: 0; padding: 0; background-color: #000; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
                              iframe { width: 100vw; height: 100vh; border: none; }
                            </style>
                          </head>
                          <body>
                            <iframe 
                              src="https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&playsinline=1&controls=1&modestbranding=1&origin=https://www.youtube.com" 
                              allow="autoplay; fullscreen"
                              allowfullscreen
                            ></iframe>
                          </body>
                        </html>
                      `,
                      baseUrl: 'https://www.youtube.com'
                    }
                  : { uri: activeMediaUrl }
                }
                style={{ flex: 1, backgroundColor: '#000' }}
                allowsFullscreenVideo={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled={true}       
                domStorageEnabled={true}
                injectedJavaScript={injectedTrackingJS}
                onMessage={handleWebViewMessage}
                userAgent={isYouTube ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36" : undefined}
                onFullscreenUpdate={handleFullscreenUpdate}
              />
            )
          ) : (
            <>
              <Image source={{ uri: `${IMG_BASE}original${details.backdrop_path || details.poster_path}` }} style={styles.heroImage} />
              <LinearGradient colors={['transparent', gradientMiddle, theme.background]} style={styles.heroGradientBottom} />
              
              {type === 'movie' && (moviePartial || movieFinished) && (
                <View style={styles.movieProgressBarBg}>
                  <View style={[styles.movieProgressBarFill, { width: `${movieProg * 100}%`, backgroundColor: theme.primary }]} />
                </View>
              )}
            </>
          )}
        </View>

        <View style={[styles.contentContainer, activeMediaUrl && { marginTop: 20 }, isTablet && styles.tabletContentContainer]}>
          
          {!activeMediaUrl && (logoObj ? (
            <Image source={{ uri: `${IMG_BASE}w500${logoObj.file_path}` }} style={styles.logo} resizeMode="contain" />
          ) : (
            <Text style={[styles.title, { color: theme.text }]}>{details.title || details.name}</Text>
          ))}

          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: theme.primary, fontWeight: 'bold' }]}>
              {Math.round(details.vote_average * 10)}% Match
            </Text>
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>{releaseYear}</Text>
            <View style={[styles.metaBadge, { borderColor: theme.textSecondary }]}>
              <Text style={[styles.metaBadgeText, { color: theme.textSecondary }]}>4K</Text>
            </View>
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>{duration}</Text>
          </View>

          <View style={[styles.mainActionRow, isTablet && { maxWidth: 500 }]}>
            <TouchableOpacity style={[styles.playButton, { backgroundColor: theme.text }]} onPress={() => handlePlay()}>
              <Ionicons name={movieFinished && type === 'movie' ? "refresh" : "play"} size={20} color={theme.background} />
              <Text style={[styles.playButtonText, { color: theme.background }]}>
                {mainPlayText}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtnGlass, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]} onPress={handlePlayTrailer}>
              <Ionicons name="videocam-outline" size={20} color={theme.text} />
              <Text style={[styles.actionBtnText, { color: theme.text }]}>Trailer</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.serverSection, isTablet && { maxWidth: 700 }]}>
            <Text style={[styles.serverTitle, { color: theme.textSecondary }]}>Streaming Source</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.serverScroll, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]} contentContainerStyle={{ padding: 4 }}>
              {watchSources.map((server, index) => {
                const isActive = selectedServerIndex === index;
                return (
                  <TouchableOpacity key={index} onPress={() => handleServerSelect(index)} activeOpacity={0.8} style={[styles.serverItem, isActive && { backgroundColor: theme.primary }]}>
                    {isActive && <Ionicons name="play" size={12} color="#fff" style={{ marginRight: 6 }} />}
                    <Text style={[styles.serverItemText, { color: isActive ? '#fff' : theme.textSecondary }]}>{server.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <Text style={[styles.overview, { color: theme.text }]} numberOfLines={isTablet ? 10 : 5}>{details.overview}</Text>

          <View style={styles.iconActionRow}>
            <TouchableOpacity style={styles.iconActionItem} onPress={handleToggleList} activeOpacity={0.7}>
              <Animated.View style={{ transform: [{ scale: listIconScale }] }}>
                <Ionicons name={inList ? "checkmark-outline" : "add-outline"} size={28} color={theme.text} />
              </Animated.View>
              <Text style={[styles.iconActionText, { color: theme.textSecondary }]}>My List</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.iconActionItem} onPress={handleShare} activeOpacity={0.7}>
              <Ionicons name="paper-plane-outline" size={28} color={theme.text} />
              <Text style={[styles.iconActionText, { color: theme.textSecondary }]}>Share</Text>
            </TouchableOpacity>
          </View>

          {currentCast.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Top Cast</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 10 }}>
                {currentCast.slice(0, 10).map((actor) => (
                  <TouchableOpacity key={actor.id} style={styles.castItem} activeOpacity={0.7} onPress={() => navigation.navigate('MainTabs', { screen: 'Search', params: { query: actor.name } })}>
                    <Image source={{ uri: actor.profile_path ? `${IMG_BASE}w185${actor.profile_path}` : 'https://via.placeholder.com/150' }} style={styles.castImage} />
                    <Text style={[styles.castName, { color: theme.text }]} numberOfLines={2}>{actor.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {type === 'tv' && details.seasons?.length > 0 && (
            <View style={styles.section}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonScrollOuter}>
                {details.seasons.filter(s => s.season_number > 0).map((season) => (
                  <TouchableOpacity key={season.id} style={[styles.seasonPill, selectedSeason === season.season_number ? { backgroundColor: theme.text, borderColor: theme.text } : { borderColor: theme.border, backgroundColor: theme.surfaceGlass }]} onPress={() => handleSeasonChange(season.season_number)}>
                    <Text style={[styles.seasonPillText, { color: selectedSeason === season.season_number ? theme.background : theme.textSecondary }]}>{season.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {loadingEpisodes ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 20 }} />
              ) : (
                <ScrollView style={{ maxHeight: 540 }} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                  {episodes.map((ep) => {
                    const prog = progressData[`${selectedSeason}-${ep.episode_number}`] || 0;
                    const isFullyWatched = prog >= 0.95;
                    const isPartiallyWatched = prog > 0 && prog < 0.95;

                    return (
                      <TouchableOpacity 
                        key={ep.id} 
                        style={[styles.episodeCard, { borderColor: theme.border, backgroundColor: theme.surfaceGlass, opacity: isFullyWatched ? 0.75 : 1 }]} 
                        onPress={() => handlePlay(ep.episode_number)}
                      >
                        <View style={styles.episodeImageContainer}>
                          <Image source={{ uri: ep.still_path ? `${IMG_BASE}w500${ep.still_path}` : `${IMG_BASE}w500${details.backdrop_path}` }} style={styles.episodeImage} />
                          
                          {isFullyWatched && <View style={styles.watchedOverlay} />}
                          
                          {isFullyWatched && (
                            <View style={[styles.watchedBadge, { backgroundColor: theme.primary }]}>
                              <Ionicons name="checkmark" size={9} color="#fff" />
                              <Text style={styles.watchedBadgeText}>WATCHED</Text>
                            </View>
                          )}

                          {(isPartiallyWatched || isFullyWatched) && (
                             <View style={styles.progressBarBg}>
                               <View style={[styles.progressBarFill, { width: `${prog * 100}%`, backgroundColor: theme.primary }]} />
                             </View>
                          )}
                        </View>
                        
                        <View style={styles.episodeInfo}>
                          <Text style={[styles.episodeTitle, { color: isFullyWatched ? theme.textSecondary : theme.text }]} numberOfLines={1}>
                            {ep.episode_number}. {ep.name}
                          </Text>
                          <Text style={[styles.episodeDuration, { color: theme.textSecondary }]}>{ep.runtime ? `${ep.runtime}m` : ''}</Text>
                          <Text style={[styles.episodeOverview, { color: theme.textSecondary }]} numberOfLines={2}>{ep.overview || "No description available."}</Text>
                        </View>
                        
                        <Ionicons name="play-circle-outline" size={32} color={isFullyWatched ? theme.textSecondary : theme.text} style={{ opacity: 0.7 }} />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        {(hasCollection || hasSimilar) && (
          <View style={[styles.section, { marginTop: 30, marginBottom: 40, paddingHorizontal: isTablet ? '10%' : SIZES.padding }]}>
            <View style={styles.tabRow}>
              {hasCollection && (
                <TouchableOpacity onPress={() => setActiveTab('collection')} style={[styles.tabButton, activeTab === 'collection' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]}>
                  <Ionicons name="albums-outline" size={18} color={activeTab === 'collection' ? theme.text : theme.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.tabText, { color: activeTab === 'collection' ? theme.text : theme.textSecondary }]}>Collection</Text>
                </TouchableOpacity>
              )}
              {hasSimilar && (
                <TouchableOpacity onPress={() => setActiveTab('similar')} style={[styles.tabButton, activeTab === 'similar' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]}>
                  <Ionicons name="grid-outline" size={18} color={activeTab === 'similar' ? theme.text : theme.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.tabText, { color: activeTab === 'similar' ? theme.text : theme.textSecondary }]}>More Like This</Text>
                </TouchableOpacity>
              )}
            </View>

            {activeCarouselData.length > 0 ? (
              <FlatList
                horizontal showsHorizontalScrollIndicator={false} data={activeCarouselData} keyExtractor={(item) => item.id.toString()} snapToInterval={145} snapToAlignment="start" decelerationRate="fast" contentContainerStyle={{ paddingRight: SIZES.padding }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.carouselCard} activeOpacity={0.9} onPress={() => navigation.push('Details', { id: item.id, type: item.media_type || type })}>
                    <Image source={{ uri: `${IMG_BASE}w500${item.poster_path}` }} style={[styles.carouselImage, { borderColor: theme.border }]} />
                  </TouchableOpacity>
                )}
              />
            ) : (
              <Text style={{ color: theme.textSecondary, fontStyle: 'italic' }}>No additional titles found.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroGradientBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  
  movieProgressBarBg: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', zIndex: 10 },
  movieProgressBarFill: { height: '100%' },

  backButton: { position: 'absolute', left: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 25 },
  iconDropShadow: { textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  
  contentContainer: { paddingHorizontal: SIZES.padding, marginTop: -100, paddingBottom: 20 },
  tabletContentContainer: { maxWidth: 900, alignSelf: 'center', width: '100%', paddingHorizontal: '5%' },
  
  logo: { width: 280, height: 90, marginBottom: 15, alignSelf: 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 10 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
  
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  metaText: { fontSize: 14, fontWeight: '600' },
  metaBadge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  metaBadgeText: { fontSize: 10, fontWeight: 'bold' },

  mainActionRow: { flexDirection: 'row', gap: 15, marginBottom: 25, width: '100%' },
  playButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 6 },
  playButtonText: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  actionBtnGlass: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 6, borderWidth: 1 },
  actionBtnText: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 },

  serverSection: { marginBottom: 25, width: '100%' },
  serverTitle: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginLeft: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  serverScroll: { borderRadius: 30, borderWidth: 1, flexGrow: 0 }, 
  serverItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 25 },
  serverItemText: { fontSize: 13, fontWeight: '700' },

  overview: { fontSize: 15, lineHeight: 22, marginBottom: 20 },

  iconActionRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: 40, marginBottom: 30, marginLeft: 10 },
  iconActionItem: { alignItems: 'center' },
  iconActionText: { fontSize: 12, marginTop: 8 },

  section: { marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  
  castItem: { width: 80, alignItems: 'center', marginRight: 15 },
  castImage: { width: 70, height: 70, borderRadius: 35, marginBottom: 8, backgroundColor: '#333' },
  castName: { fontSize: 12, textAlign: 'center', fontWeight: '500' },

  seasonScrollOuter: { marginBottom: 20 },
  seasonPill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginRight: 10, borderWidth: 1 },
  seasonPillText: { fontSize: 14, fontWeight: 'bold' },

  episodeCard: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 10, borderRadius: 8, borderWidth: 1 },
  
  episodeImageContainer: { position: 'relative', width: 120, height: 70, borderRadius: 6, overflow: 'hidden', backgroundColor: '#333' },
  episodeImage: { width: '100%', height: '100%' },
  watchedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1 },
  watchedBadge: { position: 'absolute', top: 4, left: 4, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, gap: 2, zIndex: 5 },
  watchedBadgeText: { color: '#fff', fontSize: 8, fontWeight: 'bold', letterSpacing: 0.5 },
  progressBarBg: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', zIndex: 5 },
  progressBarFill: { height: '100%' },
  
  episodeInfo: { flex: 1, marginLeft: 15, marginRight: 10 },
  episodeTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  episodeDuration: { fontSize: 12, marginBottom: 4 },
  episodeOverview: { fontSize: 11 },

  tabRow: { flexDirection: 'row', marginBottom: 20, gap: 20 },
  tabButton: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  tabText: { fontSize: 16, fontWeight: 'bold' },
  carouselCard: { marginRight: 15 },
  carouselImage: { width: 130, height: 195, borderRadius: 8, borderWidth: 1, backgroundColor: '#333' },
});