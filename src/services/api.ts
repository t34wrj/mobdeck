import axios from 'axios';

// Function to validate API token against Readeck server
export const validateApiToken = async (serverUrl: string, apiToken: string) => {
  const cleanUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
  
  try {
    console.log('[API] Attempting to connect to:', cleanUrl);
    console.log('[API] Using token:', `${apiToken.substring(0, 10)  }...${  apiToken.length > 10 ? '(hidden)' : ''}`);
    
    // Use correct Readeck API endpoint for profile validation
    const response = await axios.get(`${cleanUrl}/api/profile`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    });
    
    console.log('[API] Connection successful! Status:', response.status);
    console.log('[API] Response headers:', response.headers);
    console.log('[API] Profile data:', response.data);
    
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
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        } : 'No response',
        request: error.request ? 'Request made but no response' : 'Request not made',
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

// Function to fetch articles
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

// Function to fetch a single article by ID
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
