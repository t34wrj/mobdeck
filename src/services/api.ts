import axios from 'axios';

/**
 * Validates API token against Readeck server by fetching user profile
 * @param serverUrl - Base URL of the Readeck server
 * @param apiToken - API token to validate
 * @returns Promise resolving to validation result with user data
 * @throws Error if validation fails or network issues occur
 * @example
 * const result = await validateApiToken("https://readeck.example.com", "your-api-token");
 * if (result.isValid) {
 *   console.log("User:", result.user.username);
 * }
 */
export const validateApiToken = async (serverUrl: string, apiToken: string) => {
  const cleanUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
  
  try {
    console.log('[API] Attempting to connect to:', cleanUrl);
    console.log('[API] Using token:', apiToken ? '[TOKEN_PRESENT]' : '[NO_TOKEN]');
    
    // Use correct Readeck API endpoint for profile validation
    const response = await axios.get(`${cleanUrl}/api/profile`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    });
    
    console.log('[API] Connection successful! Status:', response.status);
    console.log('[API] Profile response received');
    // Note: Profile data not logged to prevent sensitive information disclosure
    
    // Extract user info from profile response
    const profileData = response.data;
    return {
      isValid: true,
      user: {
        id: profileData.user?.id || 'readeck-user',
        username: profileData.user?.username || 'Readeck User',
        email: profileData.user?.email || 'user@readeck.local',
        serverUrl: cleanUrl,
        lastLoginAt: new Date().toISOString(),
        tokenExpiresAt: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    };
  } catch (error) {
    console.error('[API] Error validating API token:', error);
    
    if (axios.isAxiosError(error)) {
      console.error('[API] Axios error details:', {
        code: error.code,
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        hasResponse: !!error.response,
        hasRequest: !!error.request,
        // Note: Response data and headers not logged to prevent sensitive information disclosure
      });
      
      if (error.response?.status === 401) {
        throw new Error('Invalid API token. Please check your credentials.');
      } else if (error.response?.status === 403) {
        throw new Error('Access denied. Please check your API token permissions.');
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to server at ${cleanUrl}. Is the server running?`);
      } else if (error.code === 'ENOTFOUND') {
        throw new Error(`Server not found at ${cleanUrl}. Please check the URL.`);
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Connection timeout. Please check your network connection.');
      } else if (error.response && error.response.status >= 500) {
        throw new Error(`Server error (${error.response.status}). Please try again later.`);
      } else if (error.code === 'ERR_NETWORK') {
        throw new Error('Network error. Please check your internet connection and server URL.');
      }
    }
    
    throw new Error('Failed to validate API token. Please check your credentials and server URL.');
  }
};

/**
 * Fetches articles/bookmarks from Readeck server
 * @param serverUrl - Base URL of the Readeck server
 * @param apiToken - Valid API token for authentication
 * @returns Promise resolving to articles data from the API
 * @throws Error if request fails or authentication is invalid
 */
export const fetchArticles = async (serverUrl: string, apiToken: string) => {
  try {
    const cleanUrl = serverUrl.replace(/\/$/, '');
    const response = await axios.get(`${cleanUrl}/api/bookmarks`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching articles:', error);
    throw error;
  }
};

/**
 * Fetches a single article/bookmark by ID from Readeck server
 * @param serverUrl - Base URL of the Readeck server
 * @param apiToken - Valid API token for authentication
 * @param id - Unique identifier of the article to fetch
 * @returns Promise resolving to article data
 * @throws Error if article not found or request fails
 */
export const fetchArticleById = async (serverUrl: string, apiToken: string, id: string) => {
  try {
    const cleanUrl = serverUrl.replace(/\/$/, '');
    const response = await axios.get(`${cleanUrl}/api/bookmarks/${id}`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching article with ID ${id}:`, error);
    throw error;
  }
};
