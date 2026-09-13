import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for managing backend server status
 * Handles connection checking with debouncing and duplicate prevention
 */
const useBackendStatus = (apiBaseUrl) => {
  const [backendStatus, setBackendStatus] = useState('unknown'); // 'online', 'offline', 'unknown'
  const checkInProgressRef = useRef(false);
  const initializationInProgressRef = useRef(false);
  const pollIntervalRef = useRef(null);

  // Backend server status check with duplicate execution prevention
  const checkBackendStatus = useCallback(async () => {
    // Prevent duplicate execution
    if (checkInProgressRef.current) {
      return backendStatus === 'online';
    }
    
    checkInProgressRef.current = true;
    
    try {
      const response = await fetch(`${apiBaseUrl}/health`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      });
      const isOnline = response.ok;
      setBackendStatus(isOnline ? 'online' : 'offline');
      
      // 연결 성공시 폴링 중단
      if (isOnline && pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        console.debug('Backend connected, stopping status polling');
      }
      
      return isOnline;
    } catch (error) {
      // Reduce console logs in development environment
      if (process.env.NODE_ENV === 'development') {
        console.debug('Backend server connection unavailable:', apiBaseUrl);
      } else {
        console.error('Backend server status check failed:', error);
      }
      setBackendStatus('offline');
      return false;
    } finally {
      checkInProgressRef.current = false;
    }
  }, [apiBaseUrl, backendStatus]);

  // Initialize component with server status check
  useEffect(() => {
    // Prevent duplicate execution during initialization
    if (initializationInProgressRef.current) {
      console.debug('Initialization already in progress, preventing duplicate execution');
      return;
    }
    
    initializationInProgressRef.current = true;
    
    // Async initialization function
    const initializeComponent = async () => {
      try {
        console.debug('Starting backend server status check...');
        await checkBackendStatus();
      } catch (error) {
        console.debug('Error during component initialization:', error);
      } finally {
        initializationInProgressRef.current = false;
      }
    };
    
    // Start checking immediately with faster polling
    const initTimeout = setTimeout(() => {
      initializeComponent();
    }, 100);
    
    // Set up more frequent polling during startup
    pollIntervalRef.current = setInterval(async () => {
      if (backendStatus === 'offline' || backendStatus === 'unknown') {
        await checkBackendStatus();
      }
    }, 1000); // 1초마다 체크
    
    // Cleanup function
    return () => {
      clearTimeout(initTimeout);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      initializationInProgressRef.current = false;
    };
  }, [checkBackendStatus, backendStatus]); // Include backendStatus for polling logic

  return {
    backendStatus,
    checkBackendStatus,
    isOnline: backendStatus === 'online',
    isOffline: backendStatus === 'offline',
    isUnknown: backendStatus === 'unknown'
  };
};

export default useBackendStatus;