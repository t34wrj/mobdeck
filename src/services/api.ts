import axios from 'axios';

const API_BASE_URL = 'https://api.readeckserver.com'; // Replace with your actual API base URL

// Function to fetch articles
export const fetchArticles = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/articles`);
    return response.data;
  } catch (error) {
    console.error('Error fetching articles:', error);
    throw error;
  }
};

// Function to fetch a single article by ID
export const fetchArticleById = async id => {
  try {
    const response = await axios.get(`${API_BASE_URL}/articles/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching article with ID ${id}:`, error);
    throw error;
  }
};

// Function to authenticate user
export const authenticateUser = async credentials => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/auth/login`,
      credentials
    );
    return response.data;
  } catch (error) {
    console.error('Error authenticating user:', error);
    throw error;
  }
};
