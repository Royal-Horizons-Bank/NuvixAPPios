// src/screens/ProfileScreen.js
import React, { useState, useContext, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Switch, useWindowDimensions, Modal, TextInput, KeyboardAvoidingView, Platform, Image, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { SIZES } from '../constants/theme';

// 🔥 THE FIX: Use View on Android to prevent the infinite bouncing loop, keep KeyboardAvoidingView on iOS
const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;

const getDarkerShade = (hex, percent = -30) => {
  if (!hex) return '#000000';
  let R = parseInt(hex.substring(1,3),16);
  let G = parseInt(hex.substring(3,5),16);
  let B = parseInt(hex.substring(5,7),16);

  R = parseInt(R * (100 + percent) / 100);
  G = parseInt(G * (100 + percent) / 100);
  B = parseInt(B * (100 + percent) / 100);

  R = (R<255)?R:255; G = (G<255)?G:255; B = (B<255)?B:255;
  R = Math.round((R<0)?0:R); G = Math.round((G<0)?0:G); B = Math.round((B<0)?0:B);

  const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
  const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
  const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));

  return "#"+RR+GG+BB;
};

export default function ProfileScreen() {
  const { theme, isDarkMode, toggleTheme } = useContext(ThemeContext);
  const { 
    profiles, activeProfileKey, switchProfile, 
    addProfile, updateProfile, removeProfile, verifyPassword, logout, AVATAR_COLORS 
  } = useContext(AuthContext); 
  
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [isManaging, setIsManaging] = useState(false);

  // --- PIN PROMPT MODAL STATE ---
  const [pinPromptVisible, setPinPromptVisible] = useState(false);
  const [targetProfileToEdit, setTargetProfileToEdit] = useState(null);
  const [pinActionType, setPinActionType] = useState('edit'); 
  const [enteredPromptPin, setEnteredPromptPin] = useState('');
  const [pinPromptError, setPinPromptError] = useState('');

  // --- EDIT MODAL STATE ---
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState(null); 
  
  // --- FORM STATE ---
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(AVATAR_COLORS[0]);
  const [formImage, setFormImage] = useState(null);
  const [formEnablePin, setFormEnablePin] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false); 
  const [formPin, setFormPin] = useState('');
  const [formConfirmPin, setFormConfirmPin] = useState('');
  
  // --- ERROR STATE ---
  const [nameError, setNameError] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => { if (formName.trim()) setNameError(''); }, [formName]);
  useEffect(() => { 
    setPinError(''); 
    if (!formEnablePin) { setFormPin(''); setFormConfirmPin(''); }
  }, [formPin, formConfirmPin, formEnablePin]);

  // --- PIN PROMPT HANDLERS ---
  const handlePinPromptSubmit = () => {
    if (verifyPassword(targetProfileToEdit.key, enteredPromptPin)) {
      setPinPromptVisible(false);
      if (pinActionType === 'edit') {
        openModal(targetProfileToEdit);
      } else {
        // --- REDIRECT: Valid PIN entered, switch and go Home ---
        switchProfile(targetProfileToEdit.key);
        navigation.navigate('Home');
      }
    } else {
      setPinPromptError('Incorrect password. Please try again.');
    }
  };

  // --- EDIT MODAL HANDLERS ---
  const openModal = (profile = null) => {
    setNameError('');
    setPinError('');

    if (profile) {
      setEditingProfileId(profile.key);
      setFormName(profile.name);
      setFormColor(profile.avatarColor);
      setFormImage(profile.avatarImage || null);
      setFormEnablePin(!!profile.passwordHash);
      setIsChangingPin(false); 
      setFormPin('');
      setFormConfirmPin('');
    } else {
      if (profiles.length >= 5) {
        Alert.alert('Limit Reached', 'You can only have up to 5 profiles.');
        return;
      }
      setEditingProfileId(null);
      setFormName('');
      setFormColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
      setFormImage(null);
      setFormEnablePin(false);
      setIsChangingPin(true);
      setFormPin('');
      setFormConfirmPin('');
    }
    setModalVisible(true);
  };

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      aspect: [1, 1], 
      quality: 0.2,   
      base64: true,   
    });

    if (!result.canceled && result.assets[0].base64) {
      setFormImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSave = async () => {
    let hasError = false;

    if (!formName.trim()) {
      setNameError('Profile name is required.');
      hasError = true;
    }

    let finalPassword = undefined;

    if (formEnablePin) {
      if (!editingProfileId || isChangingPin) {
        if (formPin.length < 4) {
          setPinError('Password must be at least 4 characters.');
          hasError = true;
        } else if (formPin !== formConfirmPin) {
          setPinError('Passwords do not match.');
          hasError = true;
        } else {
          finalPassword = formPin; 
        }
      } else {
        finalPassword = undefined; 
      }
    } else {
      finalPassword = null; 
    }

    if (hasError) return;

    const profileData = {
      name: formName.trim(),
      avatarColor: formColor,
      avatarImage: formImage,
      password: finalPassword
    };

    if (editingProfileId) {
      await updateProfile(editingProfileId, profileData);
    } else {
      const newProf = await addProfile(profileData);
      if (newProf) {
        // --- REDIRECT: New profile created, switch and go Home ---
        switchProfile(newProf.key);
        navigation.navigate('Home'); 
      }
    }
    
    setModalVisible(false);
    setIsManaging(false);
  };

  const handleDelete = () => {
    Alert.alert('Delete Profile', 'Are you sure you want to delete this profile?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          const success = await removeProfile(editingProfileId);
          if (success) {
            setModalVisible(false);
            setIsManaging(false);
          }
      }}
    ]);
  };

  const renderMenuItem = (icon, title, subtitle, onPress, showToggle = false, toggleValue, onToggle) => (
    <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.border }]} onPress={onPress} activeOpacity={showToggle ? 1 : 0.7}>
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon} size={24} color={theme.textSecondary} style={{ marginRight: 15 }} />
        <View>
          <Text style={[styles.menuItemTitle, { color: theme.text }]}>{title}</Text>
          {subtitle && <Text style={[styles.menuItemSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>}
        </View>
      </View>
      {showToggle ? (
        <Switch value={toggleValue} onValueChange={onToggle} trackColor={{ false: theme.border, true: theme.primary }} thumbColor="#fff"/>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, paddingTop: Math.max(insets.top, 20) }}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{isManaging ? 'Manage Profiles' : "Who's Watching?"}</Text>
        </View>

        {/* PROFILES ROW */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profilesContainer}>
          {profiles.map((profile) => {
            const isActive = profile.key === activeProfileKey;
            const initial = profile.name ? profile.name.charAt(0).toUpperCase() : '?';
            const gradientColors = [profile.avatarColor, getDarkerShade(profile.avatarColor)];

            return (
              <TouchableOpacity 
                key={profile.key} 
                style={styles.profileWrapper}
                activeOpacity={0.8}
                onPress={() => {
                  if (isManaging) {
                    if (profile.passwordHash) {
                      setTargetProfileToEdit(profile);
                      setPinActionType('edit');
                      setEnteredPromptPin('');
                      setPinPromptError('');
                      setPinPromptVisible(true);
                    } else {
                      openModal(profile);
                    }
                  } else {
                    if (profile.key !== activeProfileKey && profile.passwordHash) {
                      // Profile is locked: Trigger PIN Modal
                      setTargetProfileToEdit(profile);
                      setPinActionType('switch');
                      setEnteredPromptPin('');
                      setPinPromptError('');
                      setPinPromptVisible(true);
                    } else {
                      // --- REDIRECT: Profile has no PIN (or already active), just switch and go Home ---
                      switchProfile(profile.key);
                      navigation.navigate('Home');
                    }
                  }
                }}
              >
                <View style={styles.avatarContainer}>
                  {profile.avatarImage ? (
                    <Image source={{ uri: profile.avatarImage }} style={[styles.avatar, isActive && !isManaging ? { borderWidth: 3, borderColor: theme.text } : { borderWidth: 2, borderColor: 'transparent' }]} />
                  ) : (
                    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.avatar, isActive && !isManaging ? { borderWidth: 3, borderColor: theme.text } : { borderWidth: 2, borderColor: 'transparent' }]}>
                      <Text style={styles.avatarText}>{initial}</Text>
                    </LinearGradient>
                  )}
                  
                  {isManaging && (
                    <View style={[styles.editOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                      <Ionicons name="pencil" size={24} color="#fff" />
                    </View>
                  )}
                </View>
                
                <Text style={[styles.profileName, { color: isActive && !isManaging ? theme.text : theme.textSecondary, fontWeight: isActive && !isManaging ? 'bold' : '500' }]}>
                  {profile.name}
                </Text>
                {profile.passwordHash && !isManaging && <Ionicons name="lock-closed" size={12} color={theme.textSecondary} style={{marginTop: 4}}/>}
              </TouchableOpacity>
            );
          })}
          
          {/* ADD PROFILE BUTTON */}
          {profiles.length < 5 && (
            <TouchableOpacity style={styles.profileWrapper} activeOpacity={0.8} onPress={() => openModal(null)}>
              <View style={[styles.addAvatar, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <Ionicons name="add" size={32} color={theme.textSecondary} />
              </View>
              <Text style={[styles.profileName, { color: theme.textSecondary }]}>Add</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* MANAGE PROFILES TOGGLE */}
        <View style={styles.manageContainer}>
          <TouchableOpacity 
            style={[styles.manageBtn, { borderColor: theme.border, backgroundColor: isManaging ? theme.surface : 'transparent' }]}
            onPress={() => setIsManaging(!isManaging)}
          >
            <Ionicons name={isManaging ? "checkmark" : "pencil"} size={16} color={isManaging ? theme.text : theme.textSecondary} style={{ marginRight: 8 }} />
            <Text style={[styles.manageBtnText, { color: isManaging ? theme.text : theme.textSecondary }]}>
              {isManaging ? 'Done' : 'Manage Profiles'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* SETTINGS SECTIONS */}
        <View style={[styles.sectionContainer, isTablet && styles.sectionContainerTablet]}>
          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>App Settings</Text>
          <View style={[styles.menuBlock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {renderMenuItem('color-palette-outline', 'Dark Mode', 'Toggle app theme', null, true, isDarkMode, toggleTheme)}
          </View>

          {/* SIGN OUT BUTTON */}
          <TouchableOpacity style={[styles.signOutBtn, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]} onPress={logout}>
            <Text style={[styles.signOutBtnText, { color: theme.text }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ========================================================= */}
      {/* PIN PROMPT MODAL (Intercepts before edit/switch) */}
      {/* ========================================================= */}
      <Modal visible={pinPromptVisible} transparent animationType="fade">
        <KeyboardWrapper behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.border, maxWidth: 350 }]}>
                
                <View style={{ alignItems: 'center', marginBottom: 15 }}>
                  <Ionicons name="lock-closed" size={32} color={theme.primary} style={{ marginBottom: 10 }} />
                  <Text style={{color: theme.text, fontSize: 20, fontWeight: 'bold', marginBottom: 5}}>Profile Locked</Text>
                  <Text style={{color: theme.textSecondary, textAlign: 'center'}}>Enter password for {targetProfileToEdit?.name}</Text>
                </View>

                <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: pinPromptError ? '#e51c23' : theme.border, marginBottom: pinPromptError ? 5 : 20 }]}
                    placeholder="Password"
                    placeholderTextColor={theme.textSecondary}
                    value={enteredPromptPin}
                    onChangeText={(val) => { setEnteredPromptPin(val); setPinPromptError(''); }}
                    secureTextEntry={true}
                    autoCapitalize="none"
                    autoFocus={true}
                    returnKeyType="done"
                    onSubmitEditing={handlePinPromptSubmit}
                />
                
                {pinPromptError ? <Text style={[styles.errorText, {textAlign: 'center', marginBottom: 15, marginLeft: 0}]}>{pinPromptError}</Text> : null}

                <View style={{flexDirection: 'row', gap: 10}}>
                    <TouchableOpacity style={[styles.actionBtn, {backgroundColor: theme.surfaceGlass}]} onPress={() => setPinPromptVisible(false)}>
                        <Text style={{color: theme.text, fontWeight: 'bold', fontSize: 16}}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, {backgroundColor: enteredPromptPin ? theme.primary : theme.surfaceGlass}]} disabled={!enteredPromptPin} onPress={handlePinPromptSubmit}>
                        <Text style={{color: enteredPromptPin ? '#fff' : theme.textSecondary, fontWeight: 'bold', fontSize: 16}}>Unlock</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardWrapper>
      </Modal>

      {/* ========================================================= */}
      {/* FLOATING EDIT MODAL */}
      {/* ========================================================= */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <KeyboardWrapper behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          
          <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {editingProfileId ? 'Edit Profile' : 'Add Profile'}
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8} style={styles.avatarPreviewContainer}>
                  {formImage ? (
                    <Image source={{ uri: formImage }} style={styles.avatarPreview} />
                  ) : (
                    <LinearGradient colors={[formColor, getDarkerShade(formColor)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarPreview}>
                      <Text style={styles.avatarPreviewText}>{formName.trim() ? formName.charAt(0).toUpperCase() : '?'}</Text>
                    </LinearGradient>
                  )}
                  <View style={[styles.cameraBadge, { backgroundColor: theme.primary }]}>
                    <Ionicons name="camera" size={16} color="#fff" />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.colorPickerContainer}>
                {AVATAR_COLORS.map(color => (
                  <TouchableOpacity 
                    key={color} onPress={() => { setFormColor(color); setFormImage(null); }}
                    style={[
                      styles.colorSwatch, { backgroundColor: color },
                      formColor === color && !formImage && { borderWidth: 2, borderColor: '#fff' }
                    ]}
                  />
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>NAME</Text>
              <TextInput
                style={[
                  styles.input, 
                  { backgroundColor: theme.surface, color: theme.text, borderColor: nameError ? '#e51c23' : theme.border }
                ]}
                placeholder="Profile Name"
                placeholderTextColor={theme.textSecondary}
                value={formName}
                onChangeText={setFormName}
                maxLength={15}
              />
              {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

              <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 10 }]}>PASSWORD PROTECTION</Text>
              
              {!formEnablePin ? (
                <View style={styles.pinToggleContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} style={{ marginRight: 10 }} />
                  <Text style={{ flex: 1, color: theme.text, fontSize: 14 }}>Enable Password for this Profile</Text>
                  <Switch 
                    value={formEnablePin} 
                    onValueChange={(val) => { setFormEnablePin(val); setIsChangingPin(true); }} 
                    trackColor={{ false: theme.border, true: theme.primary }} 
                    thumbColor="#fff"
                  />
                </View>
              ) : (
                <View style={{ marginTop: 5 }}>
                  
                  {editingProfileId && !isChangingPin ? (
                    <View style={[styles.maskedPinContainer, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]}>
                       <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                           <Ionicons name="lock-closed" size={18} color={theme.primary} style={{ marginRight: 10 }} />
                           <Text style={{color: theme.text, fontSize: 24, letterSpacing: 2, marginTop: 6}}>••••••••</Text>
                       </View>
                       <TouchableOpacity onPress={() => setIsChangingPin(true)} style={styles.pinActionBtn}>
                           <Text style={[styles.pinActionText, { color: theme.text }]}>Change</Text>
                       </TouchableOpacity>
                       <TouchableOpacity onPress={() => { setFormEnablePin(false); setFormPin(''); }} style={styles.pinActionBtn}>
                           <Text style={[styles.pinActionText, { color: '#e51c23' }]}>Turn Off</Text>
                       </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      {isChangingPin && editingProfileId && (
                          <TouchableOpacity onPress={() => { setIsChangingPin(false); setFormPin(''); setFormConfirmPin(''); setPinError(''); }} style={{alignSelf: 'flex-end', marginBottom: 5}}>
                              <Text style={{color: theme.textSecondary, fontSize: 12, fontWeight: 'bold'}}>CANCEL CHANGE</Text>
                          </TouchableOpacity>
                      )}
                      
                      <TextInput
                        style={[
                          styles.input, 
                          { backgroundColor: theme.surface, color: theme.text, borderColor: pinError ? '#e51c23' : theme.border, marginBottom: 10 }
                        ]}
                        placeholder="Enter Password (Min 4 chars)"
                        placeholderTextColor={theme.textSecondary}
                        value={formPin}
                        onChangeText={setFormPin}
                        secureTextEntry={true}
                        autoCapitalize="none"
                      />
                      
                      <TextInput
                        style={[
                          styles.input, 
                          { backgroundColor: theme.surface, color: theme.text, marginBottom: 5,
                            borderColor: formConfirmPin.length > 0 ? (formPin === formConfirmPin ? '#4caf50' : '#e51c23') : theme.border 
                          }
                        ]}
                        placeholder="Verify Password"
                        placeholderTextColor={theme.textSecondary}
                        value={formConfirmPin}
                        onChangeText={setFormConfirmPin}
                        secureTextEntry={true}
                        autoCapitalize="none"
                      />
                      {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}
                      {formConfirmPin.length > 0 && formPin !== formConfirmPin && !pinError ? (
                        <Text style={styles.errorText}>Passwords do not match.</Text>
                      ) : null}
                      
                      <TouchableOpacity onPress={() => { setFormEnablePin(false); setFormPin(''); setFormConfirmPin(''); setPinError(''); }} style={{alignSelf: 'flex-start', marginTop: 5}}>
                          <Text style={{color: '#e51c23', fontSize: 12, fontWeight: 'bold'}}>REMOVE PASSWORD</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.modalActions}>
                {editingProfileId && profiles.length > 1 ? (
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                ) : <View style={{ flex: 1 }} />}
                
                <View style={styles.rightActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                    <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.saveBtn, { backgroundColor: formName.trim() ? theme.text : theme.surfaceGlass }]} 
                    disabled={!formName.trim()} 
                    onPress={handleSave}
                  >
                    <Text style={[styles.saveBtnText, { color: formName.trim() ? theme.background : theme.textSecondary }]}>✓ Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardWrapper>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SIZES.padding, marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold' },
  
  profilesContainer: { paddingHorizontal: SIZES.padding, paddingBottom: 10 },
  profileWrapper: { alignItems: 'center', marginRight: 20 },
  avatarContainer: { position: 'relative', width: 70, height: 70, borderRadius: 35 },
  avatar: { width: '100%', height: '100%', borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  addAvatar: { width: 70, height: 70, borderRadius: 35, borderWidth: 1, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' },
  profileName: { marginTop: 8, fontSize: 14 },
  editOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },

  manageContainer: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
  manageBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1 },
  manageBtnText: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },

  sectionContainer: { paddingHorizontal: SIZES.padding },
  sectionContainerTablet: { maxWidth: 600, alignSelf: 'center', width: '100%' },
  sectionHeader: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginLeft: 5 },
  menuBlock: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 30 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  menuItemTitle: { fontSize: 16, fontWeight: '500', marginBottom: 2 },
  signOutBtn: { paddingVertical: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center', marginBottom: 20 },
  signOutBtnText: { fontSize: 16, fontWeight: 'bold' },
  versionText: { textAlign: 'center', fontSize: 12, marginBottom: 40 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 24, padding: 25, borderWidth: 1, maxHeight: '90%' },
  modalHeader: { alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  
  avatarPreviewContainer: { position: 'relative' },
  avatarPreview: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center' },
  avatarPreviewText: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  cameraBadge: { position: 'absolute', bottom: -5, right: -5, width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#111', justifyContent: 'center', alignItems: 'center' },
  
  colorPickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25, justifyContent: 'center', paddingHorizontal: 20 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },

  inputLabel: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, fontSize: 16, marginBottom: 5 },
  errorText: { color: '#e51c23', fontSize: 12, marginLeft: 8, marginBottom: 10, fontWeight: '500' },
  
  pinToggleContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  
  maskedPinContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, height: 55, marginBottom: 5 },
  pinActionBtn: { marginLeft: 15, paddingVertical: 5 },
  pinActionText: { fontWeight: 'bold', fontSize: 14 },

  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, alignItems: 'center' },
  rightActions: { flexDirection: 'row', flex: 2, justifyContent: 'flex-end', alignItems: 'center' },
  
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  
  deleteBtn: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: 'rgba(229, 28, 35, 0.15)', borderRadius: 12 },
  deleteBtnText: { color: '#e51c23', fontSize: 14, fontWeight: 'bold' },
  
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 20, marginRight: 10 },
  cancelBtnText: { fontSize: 16, fontWeight: '600' },
  
  saveBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25, flexDirection: 'row', alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: 'bold' }
});