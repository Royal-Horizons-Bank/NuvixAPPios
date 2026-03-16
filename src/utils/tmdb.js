// src/utils/tmdb.js

// TODO: Replace with your actual TMDB API key from your web project
const API_KEY = '55550670b2e9a6b8c3c3c69b0bdf894f'; 
const BASE_URL = 'https://api.themoviedb.org/3';

const fetchMovies = async (endpoint) => {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('TMDB Fetch Error:', error);
    return []; // Return empty array to prevent UI crashes on failure
  }
};

export const tmdbAPI = {
  getTrending: () => fetchMovies(`/trending/all/week?api_key=${API_KEY}&language=en-US`),
  getNetflixOriginals: () => fetchMovies(`/discover/tv?api_key=${API_KEY}&with_networks=213`),
  getTopRated: () => fetchMovies(`/movie/top_rated?api_key=${API_KEY}&language=en-US`),
  getActionMovies: () => fetchMovies(`/discover/movie?api_key=${API_KEY}&with_genres=28`),
  getComedyMovies: () => fetchMovies(`/discover/movie?api_key=${API_KEY}&with_genres=35`),
  getHorrorMovies: () => fetchMovies(`/discover/movie?api_key=${API_KEY}&with_genres=27`),
  getRomanceMovies: () => fetchMovies(`/discover/movie?api_key=${API_KEY}&with_genres=10749`),
  getDocumentaries: () => fetchMovies(`/discover/movie?api_key=${API_KEY}&with_genres=99`),
  
  // Helper to get the full image URL (w500 for cards, original for hero/posters)
  getImageUrl: (path, size = 'w500') => path ? `https://image.tmdb.org/t/p/${size}${path}` : null,
};