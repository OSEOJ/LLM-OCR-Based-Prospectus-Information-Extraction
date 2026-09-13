import { useState, useCallback } from 'react';

/**
 * Custom hook for managing notifications
 * Provides notification state and display functions with auto-dismissal
 */
const useNotification = (defaultTimeout = 8000) => {
  const [notification, setNotification] = useState(null);

  // Show notification with automatic dismissal
  const showNotification = useCallback((message, type = 'success', timeout = defaultTimeout) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), timeout);
  }, [defaultTimeout]);

  // Manually dismiss notification
  const dismissNotification = useCallback(() => {
    setNotification(null);
  }, []);

  // Show specific notification types
  const showSuccess = useCallback((message) => {
    showNotification(message, 'success', 5000);
  }, [showNotification]);

  const showError = useCallback((message) => {
    showNotification(message, 'error', 10000); // Errors stay longer
  }, [showNotification]);

  const showWarning = useCallback((message) => {
    showNotification(message, 'warning', 7000);
  }, [showNotification]);

  const showInfo = useCallback((message) => {
    showNotification(message, 'info', 6000);
  }, [showNotification]);

  return {
    notification,
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    dismissNotification,
    hasNotification: notification !== null
  };
};

export default useNotification;