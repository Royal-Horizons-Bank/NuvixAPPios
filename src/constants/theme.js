// src/constants/theme.js

export const SIZES = {
  base: 8,
  small: 12,
  font: 14,
  medium: 16,
  large: 24,
  extraLarge: 32,
  padding: 20,
  radius: 12, // Standardizing border-radius for your glass panels
};

export const lightTheme = {
  mode: 'light',
  background: '#f8f9fa',
  surface: '#ffffff',
  surfaceGlass: 'rgba(255, 255, 255, 0.85)', // Brighter glass for light mode
  primary: '#0071eb', // Nuvix+ accent color
  text: '#121212',
  textSecondary: '#6c757d',
  border: 'rgba(0, 0, 0, 0.1)',
  danger: '#ff4e50',
  success: '#4caf50',
  tabBar: '#ffffff',
};

export const darkTheme = {
  mode: 'dark',
  background: '#000000',
  surface: '#121212',
  surfaceGlass: 'rgba(20, 20, 20, 0.7)', // Deep translucent glass
  primary: '#0071eb',
  text: '#ffffff',
  textSecondary: '#a0a0a0',
  border: 'rgba(255, 255, 255, 0.1)',
  danger: '#ff4e50',
  success: '#4caf50',
  tabBar: '#0a0a0a',
};