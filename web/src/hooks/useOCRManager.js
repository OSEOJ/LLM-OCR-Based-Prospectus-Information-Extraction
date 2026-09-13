import { useState, useCallback, useRef, useEffect } from 'react';
import { getWebSocketUrl } from '../utils/apiUtils';
import { fileToBase64 } from '../utils/fileUtils';

// OCR state manager - Global state management for OCR processes (Enhanced stability)
const ocrStateManager = {
  states: {},
  listeners: new Set(),
  
  getState: (fileId) => {
    return ocrStateManager.states[fileId] || { status: 'pending', progress: null };
  },
  
  setState: (fileId, newState) => {
    const currentState = ocrStateManager.states[fileId] || {};
    const updatedState = { ...currentState, ...newState };
    
    // Update only if state actually changed (deep comparison)
    const hasChanged = JSON.stringify(currentState) !== JSON.stringify(updatedState);
    
    if (hasChanged) {
      ocrStateManager.states[fileId] = updatedState;
      
      // Delay listener notifications to next tick for state stability
      setTimeout(() => {
        ocrStateManager.listeners.forEach(listener => {
          try {
            listener(fileId, { ...updatedState }); // Pass copy
          } catch (error) {
            console.error('OCR state listener error:', error);
          }
        });
      }, 0);
    }
  },
  
  subscribe: (listener) => {
    ocrStateManager.listeners.add(listener);
    return () => ocrStateManager.listeners.delete(listener);
  },
  
  reset: () => {
    ocrStateManager.states = {};
    // Delay reset notification as well
    setTimeout(() => {
      ocrStateManager.listeners.forEach(listener => {
        try {
          listener(null, null);
        } catch (error) {
          console.error('OCR state listener reset error:', error);
        }
      });
    }, 0);
  }
};

/**
 * Custom hook for managing OCR operations
 * Handles OCR state synchronization, WebSocket connections, and processing tracking
 */
// 백엔드 WebSocket 페이로드를 UI가 읽는 progress 형태로 변환한다.
// 백엔드: {current, total, page, total_pages, message} / UI: {percent, currentPage, totalPages, message}
const toProgress = (d) => ({
  percent: d.total ? Math.round((d.current / d.total) * 100) : 0,
  currentPage: d.page || 0,
  totalPages: d.total_pages || 0,
  message: d.message || ''
});

// 완료 페이로드 -> UI 상태. preview_text 가 추출 전문이다.
const toResult = (d) => ({
  percent: 100,
  currentPage: d.total_pages || 0,
  totalPages: d.total_pages || 0,
  message: 'OCR 완료',
  extractedText: d.preview_text || '',
  successRate: d.success_rate,
  pageResults: d.page_results || [],
  processingMethod: d.processing_method || 'ocr'
});

const useOCRManager = () => {
  const [ocrStatus, setOcrStatus] = useState({}); // File-specific OCR status {fileId: {status, progress, result}}
  const ocrWebSocketsRef = useRef({}); // Track OCR WebSocket connections
  const ocrProcessingRef = useRef(new Set()); // Track currently processing file IDs

  // Sync global OCR state with React state (Enhanced stability)
  useEffect(() => {
    const unsubscribe = ocrStateManager.subscribe((fileId, newState) => {
      if (fileId && newState) {
        setOcrStatus(prev => {
          // Update only if state actually changed
          const currentState = prev[fileId];
          if (JSON.stringify(currentState) !== JSON.stringify(newState)) {
            return {
              ...prev,
              [fileId]: { ...newState }
            };
          }
          return prev;
        });
      } else if (fileId === null) {
        // Complete reset
        setOcrStatus({});
      }
    });
    
    return unsubscribe;
  }, []);

  // OCR status update function (using global state manager)
  const updateOCRStatus = useCallback((fileId, status, progress = null, error = null) => {
    const newState = {
      status,
      ...(progress && { progress }),
      ...(error && { error })
    };
    
    ocrStateManager.setState(fileId, newState);
  }, []);

  // Get OCR status for a specific file
  const getOCRStatus = useCallback((fileId) => {
    return ocrStateManager.getState(fileId);
  }, []);

  // Check if OCR is processing for a file
  const isOCRProcessing = useCallback((fileId) => {
    return ocrProcessingRef.current.has(fileId);
  }, []);

  // Add file to processing list
  const addToProcessing = useCallback((fileId) => {
    ocrProcessingRef.current.add(fileId);
  }, []);

  // Remove file from processing list
  const removeFromProcessing = useCallback((fileId) => {
    ocrProcessingRef.current.delete(fileId);
  }, []);

  // Get WebSocket connection for a file
  const getWebSocket = useCallback((fileId) => {
    return ocrWebSocketsRef.current[fileId];
  }, []);

  // Set WebSocket connection for a file
  const setWebSocket = useCallback((fileId, ws) => {
    if (ws) {
      ocrWebSocketsRef.current[fileId] = ws;
    } else {
      delete ocrWebSocketsRef.current[fileId];
    }
  }, []);

  // Close all WebSocket connections
  const closeAllWebSockets = useCallback(() => {
    Object.values(ocrWebSocketsRef.current).forEach(ws => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    ocrWebSocketsRef.current = {};
  }, []);

  // WebSocket을 통한 실시간 OCR 실행 (안정성 대폭 강화)
  const runOcrPreviewWebSocket = useCallback(async (fileData) => {
    if (!fileData || !fileData.file) {
      console.error('Invalid file data for OCR:', fileData);
      return;
    }

    const fileId = fileData.id;
    const fileName = fileData.name;

    // 이미 처리 중인 파일인지 확인
    if (isOCRProcessing(fileId)) {
      console.log('OCR already in progress for:', fileName);
      return;
    }

    console.log('Starting OCR preview via WebSocket:', fileName);
    
    // 기존 WebSocket 안전하게 정리
    const existingWs = getWebSocket(fileId);
    if (existingWs) {
      console.log('Cleaning up existing WebSocket for:', fileName);
      if (existingWs.readyState === WebSocket.OPEN || existingWs.readyState === WebSocket.CONNECTING) {
        existingWs.close();
      }
      setWebSocket(fileId, null);
    }

    try {
      // WebSocket 연결 시도
      const wsUrl = getWebSocketUrl();
      console.log('WebSocket 연결 시도:', wsUrl);
      const ws = new WebSocket(wsUrl);
      
      // 연결 타임아웃 설정 (30초)
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          removeFromProcessing(fileId);
          updateOCRStatus(fileId, 'failed', null, 'WebSocket 연결 시간 초과');
          console.error('WebSocket 연결 시간 초과:', fileName);
        }
      }, 30000);

      // WebSocket 참조 저장 (연결 전에 저장)
      setWebSocket(fileId, ws);
      addToProcessing(fileId);

      // 연결 이벤트
      ws.onopen = async () => {
        clearTimeout(connectionTimeout);
        
        // 연결 후 WebSocket 참조 재확인
        if (getWebSocket(fileId) !== ws) {
          console.log('WebSocket 참조 불일치, 연결 종료:', fileName);
          ws.close();
          return;
        }

        console.log('WebSocket 연결 성공:', fileName);
        updateOCRStatus(fileId, 'processing', { percent: 0, currentPage: 0 });

        // 파일 데이터 전송 (백엔드 규약: start_ocr + base64 단일 JSON 메시지)
        try {
          const base64Data = await fileToBase64(fileData.file);

          if (ws.readyState === WebSocket.OPEN && getWebSocket(fileId) === ws) {
            ws.send(JSON.stringify({
              action: 'start_ocr',
              filename: fileName,
              file_data: base64Data
            }));
            console.log('OCR 요청 전송:', fileName, 'Size:', fileData.file.size);
          } else {
            console.log('WebSocket 상태 불일치, OCR 취소:', fileName);
            removeFromProcessing(fileId);
            updateOCRStatus(fileId, 'cancelled');
          }
        } catch (error) {
          console.error('OCR 요청 전송 실패:', fileName, error);
          updateOCRStatus(fileId, 'failed', null, `요청 전송 실패: ${error.message}`);
          removeFromProcessing(fileId);
          setWebSocket(fileId, null);
        }
      };

      // 메시지 수신 이벤트
      ws.onmessage = (event) => {
        // 메시지 수신 시 WebSocket 참조 확인
        if (getWebSocket(fileId) !== ws) {
          console.log('WebSocket 참조 불일치, 메시지 무시:', fileName);
          return;
        }

        try {
          const response = JSON.parse(event.data);
          const payload = response.data || {};
          console.log('OCR 진행 상황:', fileName, response);

          switch (response.type) {
            case 'progress':
              updateOCRStatus(fileId, 'processing', toProgress(payload));
              break;

            case 'complete':
              console.log('OCR 완료:', fileName, '텍스트 길이:', (payload.preview_text || '').length);
              updateOCRStatus(fileId, 'completed', toResult(payload));
              removeFromProcessing(fileId);
              setWebSocket(fileId, null);
              ws.close();
              break;

            case 'error':
              console.error('OCR 실패:', fileName, payload.message || 'Unknown error');
              updateOCRStatus(fileId, 'failed', null, payload.message || 'OCR processing failed');
              removeFromProcessing(fileId);
              setWebSocket(fileId, null);
              ws.close();
              break;

            default:
              console.log('알 수 없는 OCR 메시지 타입:', response.type);
          }
        } catch (error) {
          console.error('WebSocket 메시지 파싱 오류:', error);
        }
      };

      // 오류 이벤트
      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        if (ws.readyState === WebSocket.CONNECTING) {
          console.debug('WebSocket 연결 실패:', fileName, 'URL:', wsUrl);
        } else {
          console.error('WebSocket 오류:', fileName, error);
        }
        updateOCRStatus(fileId, 'failed', null, 'WebSocket connection error');
        removeFromProcessing(fileId);
        setWebSocket(fileId, null);
      };

      // 연결 종료 이벤트
      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket 연결 종료:', fileName, 'Clean:', event.wasClean, 'Code:', event.code);
        
        // 정상 종료가 아닌 경우 처리
        if (!event.wasClean) {
          const currentStatus = getOCRStatus(fileId);
          
          // 아직 처리 중이었다면 실패로 처리
          if (currentStatus.status === 'processing' || currentStatus.status === 'pending') {
            if (event.code === 1006) {
              console.warn('WebSocket 비정상 종료:', fileName, 'Code:', event.code);
              updateOCRStatus(fileId, 'failed', null, 'Connection lost unexpectedly');
            } else if (event.code === 1000) {
              // 정상 종료 코드이지만 wasClean이 false인 경우
              console.log('WebSocket 정상 종료:', fileName);
            } else {
              console.warn('WebSocket 비정상 종료:', fileName, 'Code:', event.code);
              updateOCRStatus(fileId, 'failed', null, `Connection closed with code ${event.code}`);
            }
          }
        }
        
        // WebSocket 참조 정리
        if (getWebSocket(fileId) === ws) {
          setWebSocket(fileId, null);
        }
        removeFromProcessing(fileId);
      };

    } catch (error) {
      if (error.name === 'SecurityError') {
        console.debug('WebSocket 생성 실패:', fileName, error.message);
      } else {
        console.error('WebSocket 생성 실패:', fileName, error);
      }
      updateOCRStatus(fileId, 'failed', null, 
        `WebSocket 생성 실패: ${error.message} - 네트워크 설정을 확인해주세요`
      );
      removeFromProcessing(fileId);
      setWebSocket(fileId, null);
    }
  }, [isOCRProcessing, getWebSocket, setWebSocket, addToProcessing, removeFromProcessing, updateOCRStatus, getOCRStatus]);

  // Stop all OCR processes
  const stopAllOCR = useCallback(() => {
    closeAllWebSockets();
    ocrProcessingRef.current.clear();
    ocrStateManager.reset();
  }, [closeAllWebSockets]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Only clean up on actual unmount (exclude development environment double execution)
      if (process.env.NODE_ENV === 'production') {
        console.log('Component unmount - starting OCR cleanup');
        stopAllOCR();
      }
    };
  }, [stopAllOCR]);

  // 여러 파일을 WebSocket 하나로 병렬 OCR 처리한다.
  // 단일 처리와 달리 파일마다 연결을 열지 않으므로 업로드가 많을 때 연결 수가 폭증하지 않는다.
  const runOcrBatchWebSocket = useCallback(async (filesData) => {
    const targets = (filesData || []).filter(f => f && f.file && !isOCRProcessing(f.id));
    if (targets.length === 0) return;

    const nameById = new Map(targets.map(f => [String(f.id), f.name]));

    try {
      const payload = await Promise.all(
        targets.map(async (f) => ({
          file_id: String(f.id),
          filename: f.name,
          file_data: await fileToBase64(f.file)
        }))
      );

      const ws = new WebSocket(getWebSocketUrl('ocr-batch'));
      let pending = targets.length;

      const finish = (fileId) => {
        removeFromProcessing(fileId);
        pending -= 1;
        if (pending <= 0) ws.close();
      };

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          targets.forEach(f => {
            removeFromProcessing(f.id);
            updateOCRStatus(f.id, 'failed', null, 'WebSocket 연결 시간 초과');
          });
        }
      }, 30000);

      targets.forEach(f => {
        addToProcessing(f.id);
        updateOCRStatus(f.id, 'processing', { percent: 0, currentPage: 0, totalPages: 0, message: '대기 중' });
      });

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        ws.send(JSON.stringify({ action: 'start_batch', files: payload }));
        console.log('배치 OCR 요청 전송:', targets.length, '개 파일');
      };

      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          const data = response.data || {};
          const fileId = data.file_id;

          switch (response.type) {
            case 'file_progress':
              updateOCRStatus(fileId, 'processing', toProgress(data));
              break;

            case 'file_complete':
              console.log('배치 OCR 완료:', nameById.get(fileId) || fileId);
              updateOCRStatus(fileId, 'completed', toResult(data));
              finish(fileId);
              break;

            case 'file_error':
              console.error('배치 OCR 실패:', nameById.get(fileId) || fileId, data.message);
              updateOCRStatus(fileId, 'failed', null, data.message || 'OCR processing failed');
              finish(fileId);
              break;

            case 'error':
              console.error('배치 OCR 오류:', data.message);
              targets.forEach(f => {
                updateOCRStatus(f.id, 'failed', null, data.message || 'Batch OCR failed');
                removeFromProcessing(f.id);
              });
              ws.close();
              break;

            default:
              console.log('알 수 없는 배치 메시지 타입:', response.type);
          }
        } catch (error) {
          console.error('배치 WebSocket 메시지 파싱 오류:', error);
        }
      };

      ws.onerror = () => {
        clearTimeout(connectionTimeout);
        targets.forEach(f => {
          if (isOCRProcessing(f.id)) {
            updateOCRStatus(f.id, 'failed', null, 'WebSocket connection error');
            removeFromProcessing(f.id);
          }
        });
      };

      ws.onclose = () => {
        clearTimeout(connectionTimeout);
        // 완료 메시지를 못 받은 파일은 실패로 확정한다.
        targets.forEach(f => {
          if (isOCRProcessing(f.id)) {
            updateOCRStatus(f.id, 'failed', null, 'Connection closed before completion');
            removeFromProcessing(f.id);
          }
        });
      };
    } catch (error) {
      console.error('배치 OCR 시작 실패:', error);
      targets.forEach(f => {
        updateOCRStatus(f.id, 'failed', null, `배치 시작 실패: ${error.message}`);
        removeFromProcessing(f.id);
      });
    }
  }, [isOCRProcessing, addToProcessing, removeFromProcessing, updateOCRStatus]);

  return {
    ocrStatus,
    updateOCRStatus,
    getOCRStatus,
    isOCRProcessing,
    addToProcessing,
    removeFromProcessing,
    getWebSocket,
    setWebSocket,
    closeAllWebSockets,
    stopAllOCR,
    runOcrPreviewWebSocket,
    runOcrBatchWebSocket,
    // Expose processing tracking
    processingFiles: Array.from(ocrProcessingRef.current),
    hasProcessingFiles: ocrProcessingRef.current.size > 0
  };
};

export default useOCRManager;