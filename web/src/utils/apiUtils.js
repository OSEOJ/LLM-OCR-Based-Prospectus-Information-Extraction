/**
 * API utility functions for dynamic environment configuration
 * Handles different deployment environments (localhost, localtunnel, network addresses)
 */

// Get API Base URL based on current environment
export const getApiBaseUrl = () => {
  // Check if current host is localtunnel
  if (window.location.hostname.includes('.loca.lt')) {
    return 'https://pdf-converter-api.loca.lt';
  }
  // Check if it's a local network address (e.g., 172.16.0.31)
  if (window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return `http://${window.location.hostname}:8000`;
  }
  // Default (localhost)
  return 'http://localhost:8000';
};

// Get WebSocket URL based on current environment
export const getWebSocketUrl = (endpoint = 'ocr-preview') => {
  // Check if current host is localtunnel
  if (window.location.hostname.includes('.loca.lt')) {
    return `wss://pdf-converter-api.loca.lt/ws/${endpoint}`;
  }
  // Check if it's a local network address
  if (window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return `ws://${window.location.hostname}:8000/ws/${endpoint}`;
  }
  // Default (localhost)
  return `ws://localhost:8000/ws/${endpoint}`;
};

// Common API request headers
export const getDefaultHeaders = () => ({
  'Content-Type': 'application/json',
});

// Common fetch options
export const getDefaultFetchOptions = () => ({
  mode: 'cors',
  credentials: 'omit',
});

// Error handling for API responses
export const handleApiError = async (response) => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }
  return response;
};

// Generic API request wrapper
export const apiRequest = async (endpoint, options = {}) => {
  const baseUrl = getApiBaseUrl();
  const defaultOptions = getDefaultFetchOptions();
  
  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...getDefaultHeaders(),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, config);
    return await handleApiError(response);
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
};

// Health check specific function
export const checkHealth = async () => {
  try {
    const response = await apiRequest('/health', { method: 'GET' });
    return response.ok;
  } catch (error) {
    return false;
  }
};

// File conversion specific function
export const convertFile = async (formData) => {
  return apiRequest('/api/convert', {
    method: 'POST',
    body: formData,
    headers: {} // Let browser set Content-Type for FormData
  });
};

// OCR preview specific function
export const startOCRPreview = async (formData) => {
  return apiRequest('/api/ocr-preview', {
    method: 'POST',
    body: formData,
    headers: {} // Let browser set Content-Type for FormData
  });
};

// Download file specific function
export const downloadFile = async (fileId) => {
  return apiRequest(`/api/download/${fileId}`, { method: 'GET' });
};