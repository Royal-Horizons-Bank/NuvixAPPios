// src/screens/ProfileSelectionScreen.js
import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
  Modal, TextInput, KeyboardAvoidingView, Platform, Animated, Switch, useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker'; 
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';

const API_KEY = "55550670b2e9a6b8c3c3c69b0bdf894f";
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/original";

const getDarkerShade = (hex, percent = -30) => {
  if (!hex) return '#000000';
  let R = parseInt(hex.substring(1,3),16); let G = parseInt(hex.substring(3,5),16); let B = parseInt(hex.substring(5,7),16);
  R = parseInt(R * (100 + percent) / 100); G = parseInt(G * (100 + percent) / 100); B = parseInt(B * (100 + percent) / 100);
  R = (R<255)?R:255; G = (G<255)?G:255; B = (B<255)?B:255;
  R = Math.round((R<0)?0:R); G = Math.round((G<0)?0:G); B = Math.round((B<0)?0:B);
  const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
  const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
  const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));
  return "#"+RR+GG+BB;
};

export default function ProfileSelectionScreen() {
  const { theme } = useContext(ThemeContext);
  const { 
    profiles, switchProfile, verifyPassword, 
    addProfile, updateProfile, removeProfile, AVATAR_COLORS 
  } = useContext(AuthContext);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // --- BACKGROUND & LOGO ANIMATION ---
  const [backdrops, setBackdrops] = useState([]);
  const [bgIndex, setBgIndex] = useState(0);
  const [nextBgIndex, setNextBgIndex] = useState(1);
  const fadeAnim = useRef(new Animated.Value(0)).current; 

  // --- UI STATE ---
  const [isManaging, setIsManaging] = useState(false);
  const [pinPromptVisible, setPinPromptVisible] = useState(false);
  const [targetProfile, setTargetProfile] = useState(null);
  const [pinAction, setPinAction] = useState('switch'); 
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  // --- UNIFIED FORM STATE ---
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(AVATAR_COLORS[0]);
  const [formImage, setFormImage] = useState(null);
  const [formEnablePin, setFormEnablePin] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false); 
  const [formPin, setFormPin] = useState('');
  const [formConfirmPin, setFormConfirmPin] = useState('');
  const [nameError, setNameError] = useState('');
  const [formPinError, setFormPinError] = useState('');

  // Fetch Backdrops & Logos
  useEffect(() => {
    fetch(`${BASE_URL}/trending/all/day?api_key=${API_KEY}`)
      .then(res => res.json())
      .then(async (data) => {
        const validItems = data.results.filter(m => m.backdrop_path);
        const detailedItems = await Promise.all(
          validItems.slice(0, 10).map(async (item) => {
            const resDetails = await fetch(`${BASE_URL}/${item.media_type || 'movie'}/${item.id}?api_key=${API_KEY}&append_to_response=images&include_image_language=en,null`);
            const details = await resDetails.json();
            const logo = details.images?.logos?.find(l => l.iso_639_1 === 'en') || details.images?.logos?.[0];
            
            return { 
                path: item.backdrop_path, 
                logo: logo ? logo.file_path : null
            };
          })
        );
        setBackdrops(detailedItems.sort(() => 0.5 - Math.random()));
      }).catch(err => console.error(err));
  }, []);

  // Cinematic Loop
  useEffect(() => {
    if (backdrops.length < 2) return;
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 1, duration: 2500, useNativeDriver: true }).start(() => {
        setBgIndex(nextBgIndex);
        setNextBgIndex((nextBgIndex + 1) % backdrops.length);
        fadeAnim.setValue(0);
      });
    }, 9000); 
    return () => clearInterval(interval);
  }, [backdrops, nextBgIndex]);

  // --- IMAGE PICKER ---
  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.2, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setFormImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  // --- EDIT/ADD MODAL HANDLERS ---
  const openEditModal = (profile = null) => {
    setNameError(''); setFormPinError('');
    if (profile) {
      setEditingProfileId(profile.key);
      setFormName(profile.name);
      setFormColor(profile.avatarColor);
      setFormImage(profile.avatarImage || null);
      setFormEnablePin(!!profile.passwordHash);
      setIsChangingPin(false);
      setFormPin(''); setFormConfirmPin('');
    } else {
      setEditingProfileId(null);
      setFormName('');
      setFormColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
      setFormImage(null);
      setFormEnablePin(false);
      setIsChangingPin(true);
      setFormPin(''); setFormConfirmPin('');
    }
    setModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!formName.trim()) { setNameError('Profile name is required.'); return; }
    let finalPassword = undefined;
    if (formEnablePin && (!editingProfileId || isChangingPin)) {
        if (formPin.length < 4) { setFormPinError('PIN must be at least 4 characters.'); return; }
        if (formPin !== formConfirmPin) { setFormPinError('PINs do not match.'); return; }
        finalPassword = formPin;
    } else if (!formEnablePin) { finalPassword = null; }

    const profileData = { name: formName.trim(), avatarColor: formColor, avatarImage: formImage, password: finalPassword };
    editingProfileId ? await updateProfile(editingProfileId, profileData) : await addProfile(profileData);
    setModalVisible(false);
    setIsManaging(false);
  };

  const handlePinSubmit = () => {
    if (verifyPassword(targetProfile.key, enteredPin)) {
      setPinPromptVisible(false);
      pinAction === 'edit' ? openEditModal(targetProfile) : switchProfile(targetProfile.key);
    } else {
      setPinError('Incorrect PIN. Please try again.');
    }
  };

  // --- GRID RENDERERS ---
  const renderProfileItem = (profile, isSmall = false) => {
    const initial = profile.name ? profile.name.charAt(0).toUpperCase() : '?';
    const gradientColors = [profile.avatarColor, getDarkerShade(profile.avatarColor)];
    const avatarSize = isSmall ? 75 : 90;
    
    return (
      <TouchableOpacity key={profile.key} style={styles.profileWrapper} activeOpacity={0.8} onPress={() => {
        if (isManaging) {
          if (profile.passwordHash) {
            setTargetProfile(profile); setPinAction('edit');
            setEnteredPin(''); setPinError(''); setPinPromptVisible(true);
          } else openEditModal(profile);
        } else {
          if (profile.passwordHash) {
            setTargetProfile(profile); setPinAction('switch');
            setEnteredPin(''); setPinError(''); setPinPromptVisible(true);
          } else switchProfile(profile.key);
        }
      }}>
        <View style={[styles.avatarContainer, { width: avatarSize, height: avatarSize }]}>
          {profile.avatarImage ? (
            <Image source={{ uri: profile.avatarImage }} style={styles.avatar} />
          ) : (
            <LinearGradient colors={gradientColors} style={styles.avatar}>
              <Text style={[styles.avatarText, {fontSize: isSmall ? 32 : 38}]}>{initial}</Text>
            </LinearGradient>
          )}
          {isManaging && (
            <View style={styles.manageOverlay}><Ionicons name="pencil" size={isSmall ? 28 : 32} color="#fff" /></View>
          )}
        </View>
        
        {/* Centered Padlock below the avatar */}
        {profile.passwordHash && !isManaging && (
          <View style={styles.lockBadge}><Ionicons name="lock-closed" size={14} color="#fff" /></View>
        )}
        
        <Text style={styles.profileName} numberOfLines={1}>{profile.name}</Text>
      </TouchableOpacity>
    );
  };

  const renderAddProfileItem = (isSmall = false) => {
    const avatarSize = isSmall ? 75 : 90;
    return (
      <TouchableOpacity key="add-profile-btn" style={styles.profileWrapper} activeOpacity={0.8} onPress={() => openEditModal(null)}>
        <View style={[styles.avatarContainer, { width: avatarSize, height: avatarSize }]}>
          <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
            <Ionicons name="add" size={isSmall ? 40 : 50} color="rgba(255,255,255,0.7)" />
          </View>
        </View>
        <Text style={[styles.profileName, { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>Add Profile</Text>
      </TouchableOpacity>
    );
  };

  const renderGrid = () => {
    const total = profiles.length;
    const showAdd = total < 5 && !isManaging;
    const totalItemsCount = showAdd ? total + 1 : total;
    const isSmall = totalItemsCount > 3;

    let items = profiles.map(p => renderProfileItem(p, isSmall));
    if (showAdd) {
      items.push(renderAddProfileItem(isSmall));
    }

    if (isTablet && totalItemsCount === 5) {
      return (
        <View style={styles.pyramidContainer}>
          <View style={styles.pyramidRow}>{items.slice(0, 2)}</View>
          <View style={styles.pyramidRow}>{items.slice(2, 5)}</View>
        </View>
      );
    }
    return <View style={styles.standardGrid}>{items}</View>;
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      
      {/* ========================================================= */}
      {/* CINEMATIC BACKGROUND WITH EXPO-SAFE OVERLAY */}
      {/* ========================================================= */}
      {backdrops.length > 0 && (
        <View style={StyleSheet.absoluteFill}>
          <Animated.Image source={{ uri: `${IMG_BASE}${backdrops[bgIndex].path}` }} style={[StyleSheet.absoluteFill, { opacity: fadeAnim.interpolate({inputRange:[0,1], outputRange:[1,0]}) }]} />
          <Animated.Image source={{ uri: `${IMG_BASE}${backdrops[nextBgIndex].path}` }} style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]} />
          
          <LinearGradient 
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.85)', '#000000']} 
            style={StyleSheet.absoluteFill} 
          />
        </View>
      )}

      {/* ========================================================= */}
      {/* MAIN CONTENT (Netflix Layout) */}
      {/* ========================================================= */}
      <View style={styles.content}>
        
        {/* LOGO TITLE MOVED HERE */}
        <View style={styles.logoWrapper}>
          {backdrops[bgIndex]?.logo && (
             <Animated.Image 
               source={{ uri: `${IMG_BASE}${backdrops[bgIndex].logo}` }} 
               style={[styles.logoImage, { opacity: fadeAnim.interpolate({inputRange:[0,1], outputRange:[1,0]}) }]} 
               resizeMode="contain"
             />
           )}
           {!backdrops[bgIndex]?.logo && (
              <Text style={styles.fallbackLogo}>Nuvix+</Text>
           )}
        </View>

        <Text style={styles.title}>{isManaging ? "Manage Profiles" : "Choose your avatar"}</Text>
        
        {/* SMALLER GRID WITH INTEGRATED ADD BUTTON AT BOTTOM */}
        {renderGrid()}

        {/* MANAGE PROFILES TOGGLE */}
        <TouchableOpacity 
          style={[styles.manageToggleBtn, isManaging && { backgroundColor: theme.text }]} 
          onPress={() => setIsManaging(!isManaging)}
        >
            <Ionicons name={isManaging ? "checkmark" : "pencil"} size={16} color={isManaging ? theme.background : '#fff'} style={{ marginRight: 8 }} />
            <Text style={[styles.manageToggleText, isManaging && { color: theme.background }]}>
                {isManaging ? 'Done' : 'Manage Profiles'}
            </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================= */}
      {/* UNIFIED MODAL (ProfileScreen Style) */}
      {/* ========================================================= */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <KeyboardAvoidingView behavior="padding" style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{editingProfileId ? 'Edit Profile' : 'Add Profile'}</Text>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <TouchableOpacity onPress={handlePickImage} style={styles.avatarPreviewContainer}>
                {formImage ? <Image source={{ uri: formImage }} style={styles.avatarPreview} /> :
                  <LinearGradient colors={[formColor, getDarkerShade(formColor)]} style={styles.avatarPreview}>
                    <Text style={styles.avatarPreviewText}>{formName.trim() ? formName.charAt(0).toUpperCase() : '?'}</Text>
                  </LinearGradient>
                }
                <View style={[styles.cameraBadge, { backgroundColor: theme.primary }]}><Ionicons name="camera" size={14} color="#fff" /></View>
              </TouchableOpacity>

              <View style={styles.colorPicker}>
                {AVATAR_COLORS.map(c => (
                  <TouchableOpacity key={c} onPress={() => {setFormColor(c); setFormImage(null);}} 
                    style={[styles.swatch, {backgroundColor: c}, formColor === c && !formImage && {borderWidth: 2, borderColor: '#fff'}]} 
                  />
                ))}
              </View>

              <TextInput 
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: nameError ? '#e51c23' : theme.border }]} 
                value={formName} onChangeText={setFormName} placeholder="Profile Name" placeholderTextColor={theme.textSecondary}
              />
              {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

              <View style={styles.pinToggleRow}>
                 <Text style={{color: theme.text}}>Enable PIN Protection</Text>
                 <Switch value={formEnablePin} onValueChange={(v) => {setFormEnablePin(v); setIsChangingPin(true);}} trackColor={{true: theme.primary}} />
              </View>

              {formEnablePin && (isChangingPin || !editingProfileId) && (
                <View style={{gap: 5}}>
                   <TextInput style={[styles.input, {backgroundColor: theme.surface, color: theme.text, marginBottom: 10}]} secureTextEntry value={formPin} onChangeText={setFormPin} placeholder="New 4-Digit PIN" placeholderTextColor={theme.textSecondary} />
                   <TextInput 
                      style={[styles.input, {backgroundColor: theme.surface, color: theme.text, borderColor: formConfirmPin.length > 0 ? (formPin === formConfirmPin ? '#4caf50' : '#e51c23') : theme.border, marginBottom: 5 }]} 
                      secureTextEntry value={formConfirmPin} onChangeText={setFormConfirmPin} placeholder="Confirm PIN" placeholderTextColor={theme.textSecondary} 
                   />
                   
                   {/* DYNAMIC PASSWORD MATCH FEEDBACK */}
                   {formConfirmPin.length > 0 && formPin !== formConfirmPin ? (
                       <Text style={{color: '#e51c23', fontSize: 12, marginBottom: 10, textAlign: 'center'}}>Passwords do not match</Text>
                   ) : formConfirmPin.length > 0 && formPin === formConfirmPin ? (
                       <Text style={{color: '#4caf50', fontSize: 12, marginBottom: 10, textAlign: 'center'}}>Passwords match</Text>
                   ) : null}

                </View>
              )}
              {formPinError && (!formConfirmPin || formPin === formConfirmPin) ? <Text style={styles.errorText}>{formPinError}</Text> : null}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}><Text style={{color: theme.textSecondary}}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, {backgroundColor: theme.text}]} onPress={handleSaveProfile}><Text style={{color: theme.background, fontWeight: 'bold'}}>Save</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* PIN PROMPT MODAL */}
      <Modal visible={pinPromptVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior="padding" style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.border, maxWidth: 350 }]}>
                <View style={{ alignItems: 'center', marginBottom: 15 }}>
                  <Ionicons name="lock-closed" size={32} color={theme.primary} style={{ marginBottom: 10 }} />
                  <Text style={{color: theme.text, fontSize: 20, fontWeight: 'bold', marginBottom: 5}}>Profile Locked</Text>
                  <Text style={{color: theme.textSecondary, textAlign: 'center'}}>Enter PIN for {targetProfile?.name}</Text>
                </View>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: pinError ? '#e51c23' : theme.border, marginBottom: 20 }]}
                    placeholder="PIN" placeholderTextColor={theme.textSecondary}
                    value={enteredPin} onChangeText={setEnteredPin} secureTextEntry autoFocus returnKeyType="done" onSubmitEditing={handlePinSubmit}
                />
                {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}
                <View style={{flexDirection: 'row', gap: 10}}>
                    <TouchableOpacity style={[styles.actionBtn, {backgroundColor: theme.surfaceGlass}]} onPress={() => setPinPromptVisible(false)}><Text style={{color: theme.text}}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, {backgroundColor: enteredPin ? theme.primary : theme.surfaceGlass}]} onPress={handlePinSubmit}><Text style={{color: '#fff'}}>Unlock</Text></TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  content: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', zIndex: 10, paddingBottom: 60, width: '100%' },
  
  logoWrapper: { width: '80%', height: 70, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  logoImage: { width: '100%', height: 60 },
  fallbackLogo: { fontFamily: 'Fredoka_700Bold', fontSize: 40, color: '#0071eb' },

  title: { fontSize: 24, color: '#fff', marginBottom: 30, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  pyramidContainer: { alignItems: 'center' },
  pyramidRow: { flexDirection: 'row', gap: 25, marginBottom: 35 }, // Added bottom margin to clear padlock
  
  standardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20, width: '100%', maxWidth: 450, paddingHorizontal: 20, paddingBottom: 15 },
  profileWrapper: { alignItems: 'center', width: 90, position: 'relative' },
  avatarContainer: { borderRadius: 50, overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.5, shadowRadius: 10 },
  avatar: { width: '100%', height: '100%', borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold' },
  profileName: { color: '#fff', marginTop: 16, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  
  manageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  
  // Perfectly centered padlock below the avatar
  lockBadge: { position: 'absolute', bottom: 25, left: '50%', marginLeft: -14, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  
  manageToggleBtn: { marginTop: 40, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 30, borderWidth: 1, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.5)' },
  manageToggleText: { color: '#fff', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '90%', maxWidth: 400, borderRadius: 24, padding: 25, borderWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  avatarPreviewContainer: { alignSelf: 'center', marginBottom: 20 },
  avatarPreview: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  colorPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20, justifyContent: 'center' },
  swatch: { width: 32, height: 32, borderRadius: 16 },
  input: { height: 50, borderRadius: 12, paddingHorizontal: 15, marginBottom: 10, borderWidth: 1 },
  pinToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 15 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15, marginTop: 25 },
  saveBtn: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 20 },
  cancelBtn: { paddingVertical: 12 },
  errorText: { color: '#e51c23', fontSize: 12, marginBottom: 10, textAlign: 'center' },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }
});