import React from 'react';
import '../../styles/design-system.css';

/**
 * Notifications Component
 * 알림 표시 컴포넌트
 * 
 * Features:
 * - 성공/오류/경고 알림
 * - 자동 사라짐
 * - 애니메이션 효과  
 */
const Notifications = ({ notification }) => {
  if (!notification) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path 
              d="M7.5 10L9.16667 11.6667L12.5 8.33333M17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 5.85786 5.85786 2.5 10 2.5C14.1421 2.5 17.5 5.85786 17.5 10Z" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        );
      case 'error':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path 
              d="M10 17.5C14.1421 17.5 17.5 14.1421 17.5 10C17.5 5.85786 14.1421 2.5 10 2.5C5.85786 2.5 2.5 5.85786 2.5 10C2.5 14.1421 5.85786 17.5 10 17.5Z" 
              stroke="currentColor" 
              strokeWidth="1.5"
            />
            <path 
              d="M12.5 7.5L7.5 12.5M7.5 7.5L12.5 12.5" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path 
              d="M8.57465 3.69722L1.51132 15.8639C1.37751 16.1126 1.31036 16.3932 1.31674 16.677C1.32312 16.9608 1.40284 17.2379 1.54751 17.4805C1.69217 17.7231 1.89681 17.9225 2.14193 18.0586C2.38704 18.1947 2.66421 18.2628 2.94465 18.2556H17.0713C17.3518 18.2628 17.6289 18.1947 17.874 18.0586C18.1192 17.9225 18.3238 17.7231 18.4685 17.4805C18.6131 17.2379 18.6929 16.9608 18.6992 16.677C18.7056 16.3932 18.6385 16.1126 18.5046 15.8639L11.4413 3.69722C11.2999 3.46114 11.0997 3.26997 10.8609 3.1424C10.6221 3.01484 10.3527 2.94531 10.078 2.94531C9.80325 2.94531 9.53384 3.01484 9.29506 3.1424C9.05628 3.26997 8.85611 3.46114 8.71465 3.69722H8.57465Z" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M10 7.5V10.8333" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round"
            />
            <path 
              d="M10 14.1667H10.0083" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round"
            />
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path 
              d="M10 17.5C14.1421 17.5 17.5 14.1421 17.5 10C17.5 5.85786 14.1421 2.5 10 2.5C5.85786 2.5 2.5 5.85786 2.5 10C2.5 14.1421 5.85786 17.5 10 17.5Z" 
              stroke="currentColor" 
              strokeWidth="1.5"
            />
            <path 
              d="M10 6.66667V10" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round"
            />
            <path 
              d="M10 13.3333H10.0083" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round"
            />
          </svg>
        );
    }
  };

  return (
    <div className="notifications-container">
      <div className={`notification ${notification.type}`}>
        <div className="notification-icon">
          {getIcon(notification.type)}
        </div>
        <div className="notification-content">
          <p className="notification-message">{notification.message}</p>
        </div>
      </div>
    </div>
  );
};

export default Notifications;