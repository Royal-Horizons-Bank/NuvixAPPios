// src/context/LibraryContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { AuthContext } from './AuthContext';

export const LibraryContext = createContext();

export const LibraryProvider = ({ children }) => {
  const { user, isGuest, activeProfileKey } = useContext(AuthContext);
  
  const [watchlist, setWatchlist] = useState([]);
  const [history, setHistory] = useState([]);
  const db = firebase.firestore();

  // ============================================================================
  // 1. LIVE SYNC: Listen to Firestore or Local Storage based on Auth State
  // ============================================================================
  useEffect(() => {
    if (!activeProfileKey) {
        setWatchlist([]);
        setHistory([]);
        return;
    }

    let unsubscribeList = null;
    let unsubscribeHistory = null;

    if (user && !isGuest) {
        // 🟢 ONLINE MODE: Live Sync with the exact Web Database path
        const profileDbRef = db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey);
        
        // Listen to My List
        unsubscribeList = profileDbRef.collection('myList').onSnapshot(snapshot => {
            const listData = snapshot.docs.map(doc => doc.data());
            setWatchlist(listData);
        }, error => console.error("Error syncing MyList:", error));

        // Listen to Watch History
        unsubscribeHistory = profileDbRef.collection('watchHistory')
            .orderBy('watchedAt', 'desc')
            .limit(100)
            .onSnapshot(snapshot => {
                const historyData = snapshot.docs.map(doc => doc.data());
                
                // 🔥 THE FIX: Sanitize legacy data by removing duplicate IDs. 
                // Because they are ordered by 'watchedAt' desc, the first one we see is the newest.
                const uniqueHistory = historyData.filter((item, index, self) =>
                    index === self.findIndex((t) => t.id === item.id)
                );

                setHistory(uniqueHistory);
            }, error => console.error("Error syncing History:", error));

    } else {
        // 🟡 GUEST MODE: Fetch from Phone Storage mapped to Profile Key
        const loadLocalData = async () => {
            try {
                const localList = await AsyncStorage.getItem(`myList_${activeProfileKey}`);
                if (localList) setWatchlist(JSON.parse(localList));
                
                const localHistory = await AsyncStorage.getItem(`recentlyWatched_${activeProfileKey}`);
                if (localHistory) {
                    const parsedHistory = JSON.parse(localHistory);
                    
                    // 🔥 THE FIX: Sanitize local data for duplicates as well
                    const uniqueHistory = parsedHistory.filter((item, index, self) =>
                        index === self.findIndex((t) => t.id === item.id)
                    );
                    
                    setHistory(uniqueHistory);
                }
            } catch (error) {
                console.error("Error loading local library:", error);
            }
        };
        loadLocalData();
    }

    // Cleanup listeners when switching profiles or unmounting
    return () => {
        if (unsubscribeList) unsubscribeList();
        if (unsubscribeHistory) unsubscribeHistory();
    };
  }, [user, isGuest, activeProfileKey]);

  // ============================================================================
  // 2. LIBRARY ACTIONS (Add/Remove)
  // ============================================================================

  const isInWatchlist = (id) => {
    return watchlist.some(item => item.id === id);
  };

  const toggleWatchlist = async (item) => {
    if (!activeProfileKey) return;

    const itemType = item.type || item.media_type || (item.name && !item.title ? 'tv' : 'movie');
    
    // Clean data matching the Web format perfectly
    const itemData = {
        id: item.id,
        type: itemType,
        title: item.title || item.name,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path || null,
        vote_average: item.vote_average || 0,
        release_date: item.release_date || item.first_air_date || null
    };

    if (user && !isGuest) {
        // Push directly to Firebase
        const docRef = db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('myList').doc(`${itemType}-${item.id}`);
        
        if (isInWatchlist(item.id)) {
            await docRef.delete();
        } else {
            await docRef.set(itemData);
        }
    } else {
        // Handle Local State
        let newList = [...watchlist];
        if (isInWatchlist(item.id)) {
            newList = newList.filter(i => i.id !== item.id);
        } else {
            newList.push(itemData);
        }
        setWatchlist(newList);
        await AsyncStorage.setItem(`myList_${activeProfileKey}`, JSON.stringify(newList));
    }
  };

  const addToHistory = async (item) => {
    if (!activeProfileKey) return;

    const itemType = item.type || item.media_type || (item.name && !item.title ? 'tv' : 'movie');
    
    const historyItem = {
        id: item.id,
        type: itemType,
        title: item.title || item.name,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path || null,
        episode_still_path: item.episode_still_path || null, 
        last_watched_season: item.last_watched_season || null, 
        last_watched_episode: item.last_watched_episode || null, 
        savedProgress: item.savedProgress || 0, 
        progressMap: item.progressMap || {}, 
        watchedAt: Date.now()
    };

    if (user && !isGuest) {
        // Push directly to Firebase (using merge to safely update)
        const docRef = db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('watchHistory').doc(`${itemType}-${item.id}`);
        await docRef.set(historyItem, { merge: true });
    } else {
        // Handle Local State
        let newHistory = history.filter(i => i.id !== item.id);
        newHistory.unshift(historyItem);
        newHistory = newHistory.slice(0, 100); // Keep max 100 items
        setHistory(newHistory);
        await AsyncStorage.setItem(`recentlyWatched_${activeProfileKey}`, JSON.stringify(newHistory));
    }
  };

  const removeFromHistory = async (itemId) => {
    if (!activeProfileKey) return;

    try {
        const itemToRemove = history.find(item => item.id === itemId);
        if (!itemToRemove) return;

        const itemType = itemToRemove.type || itemToRemove.media_type || (itemToRemove.name && !itemToRemove.title ? 'tv' : 'movie');

        if (user && !isGuest) {
            // Delete directly from Firebase
            const docRef = db.collection('users')
                .doc(user.uid)
                .collection('profiles')
                .doc(activeProfileKey)
                .collection('watchHistory')
                .doc(`${itemType}-${itemId}`);
            
            await docRef.delete();
        } else {
            // Handle Local State deletion for Guests
            const updatedHistory = history.filter((item) => item.id !== itemId);
            setHistory(updatedHistory);
            await AsyncStorage.setItem(`recentlyWatched_${activeProfileKey}`, JSON.stringify(updatedHistory)); 
        }
    } catch (error) {
        console.error("Error removing from history:", error);
    }
  };

  return (
    <LibraryContext.Provider value={{ watchlist, history, toggleWatchlist, isInWatchlist, addToHistory, removeFromHistory }}>
        {children}
    </LibraryContext.Provider>
  );
};