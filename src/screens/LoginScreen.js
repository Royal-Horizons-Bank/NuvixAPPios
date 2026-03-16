// src/screens/LoginScreen.js
import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { SIZES } from '../constants/theme';

export default function LoginScreen() {
  const { theme } = useContext(ThemeContext);
  const { login, enableGuestMode } = useContext(AuthContext);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      Alert.alert("Login Failed", error.message);
      setIsLoading(false);
    }
  };

  const handleGuest = async () => {
    setIsLoading(true);
    await enableGuestMode();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.glassPanel, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]}>
        
        <Text style={[styles.title, { color: theme.text }]}>Sign In</Text>
        
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: theme.border }]}
          placeholder="Email address"
          placeholderTextColor={theme.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: theme.border }]}
          placeholder="Password"
          placeholderTextColor={theme.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity onPress={handleLogin} disabled={isLoading}>
          <LinearGradient colors={['#e51c23', '#ff4e50']} style={styles.button}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleGuest} style={styles.guestButton} disabled={isLoading}>
          <Text style={[styles.guestText, { color: theme.textSecondary }]}>Continue as Guest</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
  },
  glassPanel: {
    width: '100%',
    maxWidth: 400,
    padding: 30,
    borderRadius: SIZES.radius,
    borderWidth: 1,
  },
  title: {
    fontSize: SIZES.extraLarge,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderRadius: SIZES.radius,
    paddingHorizontal: 15,
    marginBottom: 16,
    borderWidth: 1,
  },
  button: {
    height: 50,
    borderRadius: SIZES.radius,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: SIZES.medium,
    fontWeight: 'bold',
  },
  guestButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  guestText: {
    fontSize: SIZES.font,
    textDecorationLine: 'underline',
  },
});