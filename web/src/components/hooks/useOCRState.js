import { useState, useEffect, useRef, useCallback } from 'react';

// OCR 상태를 완전히 독립적으로 관리하는 전역 상태 (메모리 최적화)
class OCRStateManager {
  constructor() {
    this.states = new Map();
    this.listeners = new Set();
    this.cleanupTimer = null;
    this.CLEANUP_INTERVAL = 60000; // 1분
    this.MAX_STATES = 50; // 최대 상태 보관 개수
    
    this.startCleanupTimer();
  }

  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  cleanup() {
    // LRU 방식으로 오래된 상태 제거
    if (this.states.size > this.MAX_STATES) {
      const entries = Array.from(this.states.entries());
      const toRemove = entries.slice(0, entries.length - this.MAX_STATES);
      toRemove.forEach(([key]) => {
        this.states.delete(key);
      });
    }
  }

  getState(fileId) {
    if (!fileId) return { status: 'pending', progress: null };
    
    const state = this.states.get(fileId);
    if (state) {
      // 액세스한 상태를 맨 뒤로 이동 (LRU)
      this.states.delete(fileId);
      this.states.set(fileId, state);
      return state;
    }
    return { status: 'pending', progress: null };
  }

  setState(fileId, newState) {
    if (!fileId) return;
    
    const currentState = this.states.get(fileId) || {};
    const updatedState = { ...currentState, ...newState, lastUpdated: Date.now() };
    
    // 얕은 비교로 성능 개선
    const hasChanged = Object.keys(updatedState).some(key => 
      updatedState[key] !== currentState[key]
    );
    
    if (hasChanged) {
      this.states.set(fileId, updatedState);
      
      // 비동기 리스너 알림
      Promise.resolve().then(() => {
        this.notifyListeners(fileId, { ...updatedState });
      });
    }
  }

  notifyListeners(fileId, state) {
    this.listeners.forEach(listener => {
      try {
        listener(fileId, state);
      } catch (error) {
        console.error('OCR 상태 리스너 오류:', error);
      }
    });
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }
    
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(fileId) {
    if (fileId) {
      this.states.delete(fileId);
    } else {
      this.states.clear();
    }
  }

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.states.clear();
    this.listeners.clear();
  }
}

// 싱글톤 인스턴스
const ocrStateManager = new OCRStateManager();

// 애플리케이션 종료 시 정리
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    ocrStateManager.destroy();
  });
}

export const useOCRState = (fileId) => {
  const [ocrState, setOCRState] = useState(() => ocrStateManager.getState(fileId));
  const unsubscribeRef = useRef(null);

  // OCR 상태 업데이트 함수
  const updateOCRState = useCallback((newState) => {
    ocrStateManager.setState(fileId, newState);
  }, [fileId]);

  // 상태 초기화 함수
  const clearOCRState = useCallback(() => {
    ocrStateManager.clear(fileId);
    setOCRState({ status: 'pending', progress: null });
  }, [fileId]);

  // 상태 구독
  useEffect(() => {
    if (!fileId) return;

    const handleStateChange = (changedFileId, newState) => {
      if (changedFileId === fileId) {
        setOCRState(newState);
      }
    };

    unsubscribeRef.current = ocrStateManager.subscribe(handleStateChange);
    
    // 초기 상태 설정
    const initialState = ocrStateManager.getState(fileId);
    setOCRState(initialState);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [fileId]);

  return {
    ocrState,
    updateOCRState,
    clearOCRState,
    isProcessing: ocrState.status === 'processing',
    isComplete: ocrState.status === 'complete',
    hasError: ocrState.status === 'error',
    progress: ocrState.progress
  };
};

export { ocrStateManager };