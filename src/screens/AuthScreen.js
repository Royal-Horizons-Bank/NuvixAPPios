// src/screens/AuthScreen.js
import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, ScrollView, Animated, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

export default function AuthScreen() {
  const { theme } = useContext(ThemeContext);
  const { login, signup, resetPassword, loginAsGuest } = useContext(AuthContext);
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState('login'); // 'login', 'signup', 'forgot'
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  // --- PREMIUM DRIFTING ORBS ANIMATION ---
  const orb1Y = useRef(new Animated.Value(0)).current;
  const orb2Y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(orb1Y, { toValue: -60, duration: 8000, useNativeDriver: true }),
        Animated.timing(orb1Y, { toValue: 0, duration: 8000, useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orb2Y, { toValue: 60, duration: 10000, useNativeDriver: true }),
        Animated.timing(orb2Y, { toValue: 0, duration: 10000, useNativeDriver: true })
      ])
    ).start();
  }, []);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccessMsg('');
    setPassword('');
    setConfirmPassword('');
    setFocusedInput(null);
  };

  const handleAuthAction = async () => {
    Keyboard.dismiss();
    setError('');
    setSuccessMsg('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        if (!password) { setError('Please enter your password.'); setLoading(false); return; }
        await login(email.trim(), password);

      } else if (mode === 'signup') {
        if (!password) { setError('Please enter a password.'); setLoading(false); return; }
        if (password !== confirmPassword) { setError('Passwords do not match.'); setLoading(false); return; }
        
        await signup(email.trim(), password);
        switchMode('login');
        setSuccessMsg('Account created! Please check your email to verify before signing in.');

      } else if (mode === 'forgot') {
        await resetPassword(email.trim());
        switchMode('login');
        setSuccessMsg('Password reset link sent! Please check your inbox.');
      }
    } catch (err) {
      switch (err.code) {
        case 'auth/invalid-email': setError('Invalid email address format.'); break;
        case 'auth/user-not-found': setError('No account found with this email.'); break;
        case 'auth/wrong-password': setError('Incorrect password.'); break;
        case 'auth/email-already-in-use': setError('Email is already registered.'); break;
        case 'auth/password-does-not-meet-requirements': setError('Password must be at least 6 characters, including a number and a special character.'); break;
        case 'auth/weak-password': setError('Password must be at least 6 characters.'); break;
        case 'auth/invalid-credential': setError('Invalid credentials. Please try again.'); break;
        case 'auth/unverified-email': setError(err.message); break;
        default: setError(err.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      
      {/* --- AMBIENT DRIFTING BACKGROUND --- */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={['#070a13', '#000000', '#000000']} style={StyleSheet.absoluteFill} />
        
        {/* Top Left Orb */}
        <Animated.View style={[styles.ambientOrb, { 
            top: -150, left: -100, 
            backgroundColor: '#08fded', 
            opacity: 0.15,
            transform: [{ translateY: orb1Y }] 
        }]} />
        
        {/* Bottom Right Orb */}
        <Animated.View style={[styles.ambientOrb, { 
            bottom: -150, right: -50, 
            backgroundColor: '#6ae70e', 
            opacity: 0.12,
            transform: [{ translateY: orb2Y }] 
        }]} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 50 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          <View style={styles.headerContainer}>
            <Text style={[styles.logoText, { color: theme.primary }]}>Nuvix+</Text>
            <Text style={styles.tagline}>Unlock the universe of cinema.</Text>
          </View>

          {/* --- OBSIDIAN GLASS CARD --- */}
          <View style={styles.authCard}>
            <Text style={styles.title}>
              {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Join Nuvix+' : 'Recover Account'}
            </Text>

            {successMsg ? (
                <View style={styles.successBox}>
                    <Ionicons name="checkmark-circle" size={20} color="#4caf50" style={{ marginRight: 8 }} />
                    <Text style={styles.successText}>{successMsg}</Text>
                </View>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Email Input */}
            <View style={[
                styles.inputWrapper, 
                focusedInput === 'email' && { borderColor: theme.primary, backgroundColor: 'rgba(255,255,255,0.08)' }
            ]}>
                <Ionicons name="mail-outline" size={20} color={focusedInput === 'email' ? theme.primary : '#8e8e93'} style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="Email Address"
                    placeholderTextColor="#666"
                    value={email}
                    onChangeText={(val) => { setEmail(val); setError(''); setSuccessMsg(''); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setFocusedInput('email')}
                    onBlur={() => setFocusedInput(null)}
                />
            </View>

            {/* Password Input */}
            {mode !== 'forgot' && (
              <View style={[
                  styles.inputWrapper, 
                  focusedInput === 'password' && { borderColor: theme.primary, backgroundColor: 'rgba(255,255,255,0.08)' }
              ]}>
                <Ionicons name="lock-closed-outline" size={20} color={focusedInput === 'password' ? theme.primary : '#8e8e93'} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={(val) => { setPassword(val); setError(''); }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#8e8e93" />
                </TouchableOpacity>
              </View>
            )}

            {/* Confirm Password Input */}
            {mode === 'signup' && (
              <View style={[
                  styles.inputWrapper, 
                  focusedInput === 'confirm' && { borderColor: theme.primary, backgroundColor: 'rgba(255,255,255,0.08)' }
              ]}>
                <Ionicons name="shield-checkmark-outline" size={20} color={focusedInput === 'confirm' ? theme.primary : '#8e8e93'} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#666"
                  value={confirmPassword}
                  onChangeText={(val) => { setConfirmPassword(val); setError(''); }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  onFocus={() => setFocusedInput('confirm')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>
            )}

            {mode === 'login' && (
                <TouchableOpacity style={styles.forgotBtn} onPress={() => switchMode('forgot')}>
                    <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.submitBtn, { backgroundColor: theme.text, opacity: loading ? 0.7 : 1 }]} 
              onPress={handleAuthAction}
              disabled={loading}
            >
              {loading ? (
                  <ActivityIndicator color={theme.background} />
              ) : (
                  <Text style={[styles.submitBtnText, { color: theme.background }]}>
                    {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
                  </Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerLinks}>
                {mode === 'forgot' ? (
                    <TouchableOpacity onPress={() => switchMode('login')} style={styles.footerLinkRow}>
                        <Ionicons name="arrow-back" size={16} color="#8e8e93" style={{ marginRight: 6 }} />
                        <Text style={styles.footerLinkTextAction}>Return to Sign In</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.footerLinkRow}>
                        <Text style={styles.footerLinkTextBase}>
                            {mode === 'login' ? "New to Nuvix+?" : "Already have an account?"}
                        </Text>
                        <TouchableOpacity onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
                            <Text style={[styles.footerLinkTextAction, { color: theme.primary }]}>
                                {mode === 'login' ? ' Sign up' : ' Sign in'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
          </View>

          {/* ELEGANT GUEST BUTTON */}
          <TouchableOpacity style={styles.guestBtn} onPress={loginAsGuest}>
            <Text style={styles.guestBtnText}>Explore as Guest</Text>
            <Ionicons name="chevron-forward" size={16} color="#8e8e93" style={{marginLeft: 4, marginTop: 2}}/>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  
  ambientOrb: { position: 'absolute', width: width * 1.2, height: width * 1.2, borderRadius: width * 0.6, filter: 'blur(90px)' },

  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60, paddingHorizontal: 25 },
  
  headerContainer: { alignItems: 'center', marginBottom: 50 },
  logoText: { fontFamily: 'Fredoka_700Bold', fontSize: 56, letterSpacing: 1.5, marginBottom: 5 },
  tagline: { color: '#8e8e93', fontSize: 16, fontWeight: '500', letterSpacing: 0.5 },
  
  authCard: { 
      width: '100%', 
      maxWidth: 420, 
      borderRadius: 24, 
      padding: 30, 
      backgroundColor: 'rgba(255, 255, 255, 0.03)', // Ultra-frosted obsidian glass
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  
  title: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 30, letterSpacing: 0.5 },
  
  inputWrapper: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      height: 60, 
      backgroundColor: 'rgba(255,255,255,0.04)', 
      borderRadius: 16, 
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.05)',
      marginBottom: 16,
      paddingHorizontal: 15
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: '100%', fontSize: 16, color: '#fff', fontWeight: '500' },
  eyeIcon: { padding: 10 },
  
  errorText: { color: '#ff4d4d', fontSize: 13, marginBottom: 20, fontWeight: '600', marginTop: -5, marginLeft: 5 },
  
  successBox: { flexDirection: 'row', backgroundColor: 'rgba(76, 175, 80, 0.1)', padding: 14, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(76, 175, 80, 0.3)' },
  successText: { color: '#4caf50', fontSize: 14, fontWeight: '500', flex: 1, lineHeight: 20 },

  forgotBtn: { alignSelf: 'flex-end', marginBottom: 30, marginTop: -5 },
  forgotText: { color: '#8e8e93', fontSize: 14, fontWeight: '600' },
  
  submitBtn: { height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginTop: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 },
  submitBtnText: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  
  footerLinks: { marginTop: 35, alignItems: 'center' },
  footerLinkRow: { flexDirection: 'row', alignItems: 'center' },
  footerLinkTextBase: { color: '#8e8e93', fontSize: 15, fontWeight: '500' },
  footerLinkTextAction: { color: '#fff', fontSize: 15, fontWeight: '800' },

  guestBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 45, paddingVertical: 12, paddingHorizontal: 20 },
  guestBtnText: { color: '#8e8e93', fontSize: 16, fontWeight: '600', letterSpacing: 0.5 }
});