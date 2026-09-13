import { useRef, useCallback, useEffect } from 'react';

export const useWebSocket = (url, onMessage, onError) => {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const messageQueueRef = useRef([]);
  const isConnectedRef = useRef(false);

  // WebSocket 연결
  const connect = useCallback(() => {
    try {
      // 기존 연결 정리
      if (wsRef.current) {
        wsRef.current.close();
      }

      wsRef.current = new WebSocket(url);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket 연결 성공');
        isConnectedRef.current = true;
        
        // 대기 중인 메시지 전송
        while (messageQueueRef.current.length > 0) {
          const message = messageQueueRef.current.shift();
          wsRef.current.send(message);
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessage) {
            onMessage(data);
          }
        } catch (error) {
          console.error('WebSocket 메시지 파싱 오류:', error);
          if (onError) {
            onError(new Error('메시지 파싱 실패'));
          }
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket 연결 종료:', event.code, event.reason);
        isConnectedRef.current = false;
        
        // 의도적이지 않은 종료인 경우 재연결 시도
        if (event.code !== 1000 && event.code !== 1001) {
          scheduleReconnect();
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket 오류:', error);
        isConnectedRef.current = false;
        if (onError) {
          onError(new Error('WebSocket 연결 오류'));
        }
      };
    } catch (error) {
      console.error('WebSocket 연결 생성 오류:', error);
      if (onError) {
        onError(error);
      }
    }
  }, [url, onMessage, onError]);

  // 재연결 스케줄링
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('WebSocket 재연결 시도...');
      connect();
    }, 3000);
  }, [connect]);

  // 메시지 전송
  const sendMessage = useCallback((message) => {
    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      
      if (isConnectedRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(messageStr);
      } else {
        // 연결이 없으면 큐에 저장
        messageQueueRef.current.push(messageStr);
        
        // 연결 시도
        if (!isConnectedRef.current) {
          connect();
        }
      }
    } catch (error) {
      console.error('메시지 전송 오류:', error);
      if (onError) {
        onError(error);
      }
    }
  }, [connect, onError]);

  // 연결 종료
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      isConnectedRef.current = false;
      wsRef.current.close(1000, 'Normal closure');
      wsRef.current = null;
    }
    
    // 메시지 큐 정리
    messageQueueRef.current = [];
  }, []);

  // 연결 상태 확인
  const isConnected = useCallback(() => {
    return isConnectedRef.current && wsRef.current?.readyState === WebSocket.OPEN;
  }, []);

  // 정리 함수
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    sendMessage,
    isConnected,
    reconnect: connect
  };
};