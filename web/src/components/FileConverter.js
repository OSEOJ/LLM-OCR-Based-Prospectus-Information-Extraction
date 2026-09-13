import React, { useState, useRef, useCallback, useMemo } from 'react';
import { saveAs } from 'file-saver';
import TextHighlighter from './TextHighlighter';

// OCR 상태를 완전히 독립적으로 관리하는 전역 상태 (안정성 강화)
const ocrStateManager = {
  states: {},
  listeners: new Set(),
  
  getState: (fileId) => {
    return ocrStateManager.states[fileId] || { status: 'pending', progress: null };
  },
  
  setState: (fileId, newState) => {
    const currentState = ocrStateManager.states[fileId] || {};
    const updatedState = { ...currentState, ...newState };
    
    // 상태가 실제로 변경된 경우만 업데이트 (깊은 비교)
    const hasChanged = JSON.stringify(currentState) !== JSON.stringify(updatedState);
    
    if (hasChanged) {
      ocrStateManager.states[fileId] = updatedState;
      
      // 리스너 알림을 다음 틱으로 지연하여 상태 안정성 확보
      setTimeout(() => {
        ocrStateManager.listeners.forEach(listener => {
          try {
            listener(fileId, { ...updatedState }); // 복사본 전달
          } catch (error) {
            console.error('OCR 상태 리스너 오류:', error);
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
    // reset 알림도 지연 처리
    setTimeout(() => {
      ocrStateManager.listeners.forEach(listener => {
        try {
          listener(null, null);
        } catch (error) {
          console.error('OCR 상태 리스너 리셋 오류:', error);
        }
      });
    }, 0);
  }
};

const FileConverter = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState(null);
  const [viewMode, setViewMode] = useState('upload'); // 'upload', 'analysis'
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfPages, setPdfPages] = useState([]); // PDF 페이지 이미지들
  const [pdfLoading, setPdfLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState({}); // 파일별 OCR 상태 {fileId: {status, progress, result}}
  const [autoOcrEnabled] = useState(true); // 자동 OCR 활성화로 변경
  const [documentViewMode, setDocumentViewMode] = useState('image'); // 'image' 또는 'text'
  const [backendStatus, setBackendStatus] = useState('unknown'); // 'online', 'offline', 'unknown'
  
  // 변환 관련 상태
  const [selectedProductType, setSelectedProductType] = useState('채권선도');
  const [convertedFiles, setConvertedFiles] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [fieldMappings, setFieldMappings] = useState([]);
  const [originalText, setOriginalText] = useState('');
  const fileInputRef = useRef(null);
  const ocrWebSocketsRef = useRef({}); // OCR WebSocket 연결들을 추적
  const ocrProcessingRef = useRef(new Set()); // 현재 OCR 처리 중인 파일 ID들을 추적

  // 전역 OCR 상태를 React 상태와 동기화하는 커스텀 훅 (안정성 강화)
  React.useEffect(() => {
    const unsubscribe = ocrStateManager.subscribe((fileId, newState) => {
      if (fileId && newState) {
        setOcrStatus(prev => {
          // 상태가 실제로 변경된 경우에만 업데이트
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
        // 전체 리셋
        setOcrStatus({});
      }
    });
    
    return unsubscribe;
  }, []);

  // OCR 상태 업데이트 함수 (전역 상태 관리자 사용)
  const updateOCRStatus = useCallback((fileId, status, progress = null, error = null) => {
    const newState = {
      status,
      ...(progress && { progress }),
      ...(error && { error })
    };
    
    ocrStateManager.setState(fileId, newState);
  }, []);

  // API Base URL - 환경에 따라 동적 설정
  const getApiBaseUrl = () => {
    // 현재 호스트가 localtunnel인지 확인
    if (window.location.hostname.includes('.loca.lt')) {
      return 'https://pdf-converter-api.loca.lt';
    }
    // 로컬 네트워크 주소인지 확인 (예: 172.16.0.31)
    if (window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      return `http://${window.location.hostname}:8000`;
    }
    // 기본값 (localhost)
    return 'http://localhost:8000';
  };

  const API_BASE_URL = getApiBaseUrl();

  // WebSocket URL - 환경에 따라 동적 설정
  const getWebSocketUrl = () => {
    // 현재 호스트가 localtunnel인지 확인
    if (window.location.hostname.includes('.loca.lt')) {
      return 'wss://pdf-converter-api.loca.lt/ws/ocr-preview';
    }
    // 로컬 네트워크 주소인지 확인
    if (window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      return `ws://${window.location.hostname}:8000/ws/ocr-preview`;
    }
    // 기본값 (localhost)
    return 'ws://localhost:8000/ws/ocr-preview';
  };

  // 알림 표시 함수
  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 8000); // 에러 메시지는 조금 더 오래 표시
  }, []);

  // 백엔드 서버 상태 확인 (중복 실행 방지)
  const backendCheckInProgressRef = useRef(false);
  const checkBackendStatus = useCallback(async () => {
    // 이미 확인 중인 경우 중복 실행 방지
    if (backendCheckInProgressRef.current) {
      return backendStatus === 'online';
    }
    
    backendCheckInProgressRef.current = true;
    
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      });
      const isOnline = response.ok;
      setBackendStatus(isOnline ? 'online' : 'offline');
      return isOnline;
    } catch (error) {
      // 개발 환경에서는 콘솔 로그를 줄임
      if (process.env.NODE_ENV === 'development') {
        // console.warn 대신 console.debug 사용하여 로그 레벨 낮춤
        console.debug('백엔드 서버 연결 불가:', API_BASE_URL);
      } else {
        console.error('백엔드 서버 상태 확인 실패:', error);
      }
      setBackendStatus('offline');
      return false;
    } finally {
      backendCheckInProgressRef.current = false;
    }
  }, [API_BASE_URL, backendStatus]);

  // 컴포넌트 마운트 시 서버 상태 확인 (강력한 중복 실행 방지)
  const initializationInProgressRef = useRef(false);
  React.useEffect(() => {
    // 이미 초기화 중인 경우 중복 실행 방지
    if (initializationInProgressRef.current) {
      console.debug('초기화 이미 진행 중, 중복 실행 방지');
      return;
    }
    
    initializationInProgressRef.current = true;
    
    // 비동기 초기화 함수
    const initializeComponent = async () => {
      try {
        // 개발 환경에서도 백엔드 서버 확인 시도
        console.debug('백엔드 서버 상태 확인 시작...');
        await checkBackendStatus();
        
      } catch (error) {
        console.debug('컴포넌트 초기화 중 오류:', error);
      } finally {
        initializationInProgressRef.current = false;
      }
    };
    
    // 초기화를 약간 지연시켜 컴포넌트가 완전히 마운트된 후 실행
    const initTimeout = setTimeout(() => {
      initializeComponent();
    }, 500);
    
    // 클린업 함수
    return () => {
      clearTimeout(initTimeout);
      initializationInProgressRef.current = false;
    };
  }, []); // 의존성 배열을 비워서 한 번만 실행

  // 컴포넌트 언마운트 시에만 리소스 정리 (Strict Mode 대응)
  React.useEffect(() => {
    return () => {
      // 실제 언마운트 시에만 OCR 정리 (개발 환경의 이중 실행 제외)
      if (process.env.NODE_ENV === 'production') {
        console.log('컴포넌트 언마운트 - OCR 정리 시작');
        stopAllOcr();
      }
    };
  }, []); // 언마운트 시에만 실행

  // PDF를 페이지별 이미지로 변환 (순수 이미지 변환만)
  const convertPdfToImages = useCallback(async (file) => {
    setPdfLoading(true);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      
      // Worker 설정
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      }
      
      const fileArrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ 
        data: fileArrayBuffer,
        verbosity: 0
      }).promise;
      
      setNumPages(pdf.numPages);
      
      // 페이지 수 제한
      const maxPages = 10;
      const totalPages = Math.min(pdf.numPages, maxPages);
      
      if (pdf.numPages > maxPages) {
        showNotification(`페이지가 많아서 처음 ${maxPages}페이지만 표시합니다.`, 'info');
      }
      
      // 페이지를 이미지로 변환
      const pageImages = [];
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.2 });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({ canvasContext: context, viewport }).promise;
          
          const blob = await new Promise(resolve => 
            canvas.toBlob(resolve, 'image/jpeg', 0.8)
          );
          
          pageImages.push(URL.createObjectURL(blob));
          page.cleanup();
        } catch (pageError) {
          pageImages.push(null);
        }
      }
      
      setPdfPages(pageImages);
      
    } catch (error) {
      console.error('PDF 변환 실패:', error);
      setError('PDF를 이미지로 변환하는 중 오류가 발생했습니다.');
      setPdfPages([]);
      setNumPages(null);
    } finally {
      setPdfLoading(false);
    }
  }, [showNotification]);

  // 프로그레스 업데이트 함수
  const updateProgress = (step, percent) => {
    setProcessingStep(step);
    setProgress(percent);
  };


  // PDF → JSON 변환 함수 (기본 - 매핑 없음)
  const convertPdfToJson = async (fileData, productType) => {
    setIsProcessing(true);
    updateProgress('파일 업로드 중...', 10);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', fileData.file);
      formData.append('product_type', productType === '채권선도' ? 'bond_forward' : 'FRN');

      updateProgress('서버로 파일 전송 중...', 20);
      
      console.log('기본 API 호출 시작:', `${API_BASE_URL}/api/convert`);
      
      const response = await fetch(`${API_BASE_URL}/api/convert`, {
        method: 'POST',
        body: formData,
        mode: 'cors',
        credentials: 'omit'
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        let errorMessage = '변환 중 오류가 발생했습니다.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      updateProgress('OCR 처리 중...', 40);
      
      // 실제 응답을 기다리는 동안 프로그레스 시뮬레이션
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 2, 80));
      }, 500);

      const result = await response.json();
      console.log('변환 결과:', result);
      
      clearInterval(progressInterval);
      updateProgress('변환 완료!', 100);

      if (result.status === 'success') {
        // 매핑 정보와 원본 텍스트 저장
        if (result.field_mappings) {
          setFieldMappings(result.field_mappings);
        }
        if (result.txt_content) {
          setOriginalText(result.txt_content);
        }

        // 변환된 결과를 convertedFiles에 추가
        const convertedFile = {
          id: Date.now() + Math.random(),
          name: `${fileData.name.split('.')[0]}_${productType}.json`,
          content: JSON.stringify(result.json_result, null, 2),
          type: 'application/json',
          size: JSON.stringify(result.json_result).length,
          originalFile: fileData.name,
          fileId: result.file_id,
          processingTime: result.processing_time,
          txtContent: result.txt_content,
          hasMapping: !!(result.field_mappings && result.field_mappings.length > 0),
          mappings: result.field_mappings || [],
          originalText: result.txt_content || ''
        };

        setConvertedFiles(prev => [...prev, convertedFile]);
        showNotification('PDF 변환이 성공적으로 완료되었습니다!', 'success');
        
        // 변환된 파일을 업로드 목록에서 제거
        setFiles(prev => prev.filter(file => file.id !== fileData.id));
        
        // 자동으로 결과 선택
        setSelectedResult(convertedFile);
        
        // 매핑 정보 저장 완료
      } else {
        throw new Error(result.error || '변환에 실패했습니다.');
      }
      
    } catch (err) {
      console.error('변환 오류:', err);
      if (err.message === 'Failed to fetch') {
        const errorMsg = `백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요. (${API_BASE_URL})`;
        setError(errorMsg);
        showNotification(errorMsg, 'error');
      } else {
        const errorMsg = `PDF 변환 중 오류가 발생했습니다: ${err.message}`;
        setError(errorMsg);
        showNotification(errorMsg, 'error');
      }
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
      setProgress(0);
    }
  };

  // OCR 중단 함수 (안전성 대폭 강화)
  const stopOcrForFile = (fileId) => {
    console.log('OCR 중단 요청:', fileId);
    
    const ws = ocrWebSocketsRef.current[fileId];
    if (ws) {
      console.log('WebSocket 중단 실행:', fileId, 'readyState:', ws.readyState);
      try {
        // 이벤트 핸들러 제거
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        
        // 연결 상태와 관계없이 강제 종료
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, 'User cancelled');
        }
      } catch (error) {
        console.warn('WebSocket 종료 중 오류:', error);
      }
      
      // 참조 즉시 제거
      delete ocrWebSocketsRef.current[fileId];
    }
    
    // 처리 상태 제거
    ocrProcessingRef.current.delete(fileId);
    
    // OCR 상태를 중단됨으로 변경
    updateOCRStatus(fileId, 'cancelled', { current: 0, total: 1 });
    
    console.log('OCR 중단 완료:', fileId);
  };

  // 모든 OCR 중단 함수 (안전성 대폭 강화)
  const stopAllOcr = () => {
    console.log('모든 OCR 중단 시작');
    
    const currentConnections = Object.keys(ocrWebSocketsRef.current);
    console.log('중단할 WebSocket 연결:', currentConnections);
    
    if (currentConnections.length === 0) {
      console.log('중단할 연결이 없음');
      ocrStateManager.reset();
      return;
    }
    
    // 모든 WebSocket 연결 안전하게 종료
    currentConnections.forEach(fileId => {
      const ws = ocrWebSocketsRef.current[fileId];
      if (ws) {
        console.log('WebSocket 종료 중:', fileId, 'readyState:', ws.readyState);
        try {
          // 이벤트 핸들러 제거
          ws.onopen = null;
          ws.onmessage = null;
          ws.onerror = null;
          ws.onclose = null;
          
          // 연결 상태와 관계없이 강제 종료
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close(1000, 'User cancelled all OCR');
          }
        } catch (error) {
          console.warn('WebSocket 종료 중 오류:', fileId, error);
        }
        
        // 참조 즉시 제거
        delete ocrWebSocketsRef.current[fileId];
      }
    });
    
    // 상태 완전 초기화
    ocrWebSocketsRef.current = {};
    ocrProcessingRef.current.clear();
    ocrStateManager.reset();
    
    console.log('모든 OCR 중단 완료');
  };

  // DOCX 텍스트 추출 함수
  const extractDocxText = async (fileData) => {
    updateOCRStatus(fileData.id, 'processing', { current: 0, total: 1 });
    
    try {
      const formData = new FormData();
      formData.append('file', fileData.file);
      formData.append('product_type', selectedProductType === '채권선도' ? 'bond_forward' : 'FRN');
      
      const response = await fetch(`${API_BASE_URL}/api/convert`, {
        method: 'POST',
        body: formData,
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        updateOCRStatus(fileData.id, 'completed', { current: 1, total: 1 });
        
        // OCR 결과에 텍스트 내용 저장
        const ocrResult = {
          preview_text: result.txt_content || '텍스트를 추출했습니다.',
          full_text: result.txt_content
        };
        
        // 전역 상태에 결과 저장
        ocrStateManager.setState(fileData.id, {
          status: 'completed',
          progress: { current: 1, total: 1 },
          result: ocrResult
        });
        
        showNotification(`${fileData.name} 텍스트 추출 완료`, 'success');
      } else {
        throw new Error(result.error || '텍스트 추출에 실패했습니다.');
      }
      
    } catch (error) {
      console.error('DOCX 텍스트 추출 오류:', error);
      updateOCRStatus(fileData.id, 'error', { current: 0, total: 1 });
      showNotification(`${fileData.name} 텍스트 추출 실패: ${error.message}`, 'error');
    }
  };

  // WebSocket을 통한 실시간 OCR 실행 (안정성 대폭 강화)
  const runOcrPreviewWebSocket = async (fileData) => {
    // 중복 실행 방지
    if (ocrProcessingRef.current.has(fileData.id)) {
      console.log('OCR 이미 실행 중:', fileData.name);
      return;
    }
    
    const currentStatus = ocrStatus[fileData.id];
    if (currentStatus && ['connecting', 'processing', 'completed'].includes(currentStatus.status)) {
      console.log('OCR 상태로 인한 실행 스킵:', fileData.name, currentStatus.status);
      return;
    }
    
    // 처리 중 표시
    ocrProcessingRef.current.add(fileData.id);
    
    // 기존 WebSocket 안전하게 정리
    if (ocrWebSocketsRef.current[fileData.id]) {
      const existingWs = ocrWebSocketsRef.current[fileData.id];
      try {
        existingWs.onopen = null;
        existingWs.onmessage = null;
        existingWs.onerror = null;
        existingWs.onclose = null;
        existingWs.close();
      } catch (error) {
        // 무시
      }
      delete ocrWebSocketsRef.current[fileData.id];
    }
    
    updateOCRStatus(fileData.id, 'connecting', { current: 0, total: 1 });

    try {
      // WebSocket 연결 시도
      const wsUrl = getWebSocketUrl();
      console.log('WebSocket 연결 시도:', wsUrl);
      const ws = new WebSocket(wsUrl);
      
      // 연결 시간 제한 설정
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          updateOCRStatus(fileData.id, 'error', { current: 0, total: 1 });
          ocrProcessingRef.current.delete(fileData.id);
          ws.close();
          console.error('WebSocket 연결 시간 초과:', fileData.name);
          showNotification(`${fileData.name} OCR 연결 시간 초과 - 백엔드 서버를 확인해주세요`, 'error');
        }
      }, 10000); // 10초 제한
      
      // WebSocket 참조 저장 (연결 전에 저장)
      ocrWebSocketsRef.current[fileData.id] = ws;
      
      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        
        // 연결 후 WebSocket 참조 재확인
        if (!ocrWebSocketsRef.current[fileData.id] || ocrWebSocketsRef.current[fileData.id] !== ws) {
          console.log('WebSocket 참조 불일치, 연결 종료:', fileData.name);
          ws.close();
          return;
        }
        
        console.log('WebSocket 연결 성공:', fileData.name);
        
        const reader = new FileReader();
        reader.onload = () => {
          // 메시지 전송 전 연결 상태 재확인
          if (ws.readyState === WebSocket.OPEN && ocrWebSocketsRef.current[fileData.id] === ws) {
            const base64Data = reader.result.split(',')[1];
            const message = {
              action: 'start_ocr',
              file_data: base64Data,
              filename: fileData.name
            };
            
            try {
              ws.send(JSON.stringify(message));
              updateOCRStatus(fileData.id, 'processing', { current: 0, total: 1 });
              console.log('OCR 시작 메시지 전송 완료:', fileData.name);
            } catch (error) {
              console.error('메시지 전송 실패:', error);
              updateOCRStatus(fileData.id, 'error', { current: 0, total: 1 });
              ocrProcessingRef.current.delete(fileData.id);
              delete ocrWebSocketsRef.current[fileData.id];
              ws.close();
            }
          } else {
            console.log('WebSocket 상태 불일치, OCR 취소:', fileData.name);
            updateOCRStatus(fileData.id, 'error', { current: 0, total: 1 });
            ocrProcessingRef.current.delete(fileData.id);
            ws.close();
          }
        };
        
        reader.onerror = () => {
          console.error('파일 읽기 실패:', fileData.name);
          updateOCRStatus(fileData.id, 'error', { current: 0, total: 1 });
          ocrProcessingRef.current.delete(fileData.id);
          delete ocrWebSocketsRef.current[fileData.id];
          ws.close();
        };
        
        reader.readAsDataURL(fileData.file);
      };

      ws.onmessage = (event) => {
        // 메시지 수신 시 WebSocket 참조 확인
        if (ocrWebSocketsRef.current[fileData.id] !== ws) {
          console.log('WebSocket 참조 불일치, 메시지 무시:', fileData.name);
          return;
        }
        
        try {
          const response = JSON.parse(event.data);
          
          if (response.type === 'progress') {
            const progressData = response.data;
            console.log(`OCR 진행률: ${fileData.name} - ${progressData.current}/${progressData.total}`);
            
            // 새로운 진행률 계산 (파일 불러오기 1단계 + 페이지별 처리)
            // 예: 5페이지 문서 → 총 6단계
            // 파일 불러오기 : 1/6
            // 페이지 1 완료 : 2/6  
            // 페이지 2 완료 : 3/6
            // 페이지 3 완료 : 4/6
            // 페이지 4 완료 : 5/6
            // 페이지 5 완료 : 6/6
            const totalPages = progressData.total_pages || 1;
            const totalSteps = totalPages + 1; // 파일 불러오기(1) + 각 페이지 처리(N)
            const currentStep = 1 + (progressData.current || 0); // 파일 불러오기 완료 + 현재까지 완료된 페이지 수
            
            const progressState = {
              current: currentStep,
              total: totalSteps,
              page: progressData.page,
              total_pages: progressData.total_pages,
              // 단계별 설명 개선
              step_description: currentStep === 1 ? '파일 불러오기' : 
                               `페이지 ${progressData.page || progressData.current} 완료`
            };
            
            // 중간 텍스트 결과가 있으면 저장
            if (progressData.text || progressData.page_results) {
              ocrStateManager.setState(fileData.id, {
                status: 'processing',
                progress: progressState,
                result: {
                  preview_text: progressData.text || '처리 중...',
                  page_results: progressData.page_results || [],
                  text: progressData.text
                }
              });
            } else {
              updateOCRStatus(fileData.id, 'processing', progressState);
            }
          } else if (response.type === 'complete') {
            console.log('OCR 완료:', fileData.name);
            
            // OCR 결과 데이터 저장
            const ocrResult = response.data || {};
            console.log('OCR 결과 데이터:', ocrResult);
            
            // 최종 완료 시 진행률을 전체 단계로 설정
            const totalPages = ocrResult.total_pages || 1;
            const finalProgress = {
              current: totalPages + 1, // 전체 단계 완료
              total: totalPages + 1,
              step_description: `모든 페이지 완료 (${totalPages}페이지)`
            };
            
            // 전역 상태에 OCR 결과와 함께 완료 상태 저장
            ocrStateManager.setState(fileData.id, {
              status: 'completed',
              progress: finalProgress,
              result: {
                preview_text: ocrResult.text || ocrResult.preview_text || '텍스트를 추출했습니다.',
                full_text: ocrResult.text || ocrResult.full_text,
                page_results: ocrResult.page_results || [],
                ...ocrResult
              }
            });
            
            updateOCRStatus(fileData.id, 'completed', finalProgress);
            ocrProcessingRef.current.delete(fileData.id);
            delete ocrWebSocketsRef.current[fileData.id];
            
            showNotification(`${fileData.name} OCR 완료`, 'success');
            ws.close();
          } else if (response.type === 'error') {
            console.error('OCR 오류:', fileData.name, response.data.message);
            updateOCRStatus(fileData.id, 'error', { current: 0, total: 1 });
            ocrProcessingRef.current.delete(fileData.id);
            delete ocrWebSocketsRef.current[fileData.id];
            showNotification(`${fileData.name} OCR 실패: ${response.data.message}`, 'error');
            ws.close();
          }
        } catch (error) {
          console.error('WebSocket 메시지 파싱 오류:', error);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        
        // 개발 환경에서는 로그 레벨을 낮춤
        if (process.env.NODE_ENV === 'development') {
          console.debug('WebSocket 연결 실패:', fileData.name, 'URL:', wsUrl);
        } else {
          console.error('WebSocket 오류:', fileData.name, error);
        }
        
        updateOCRStatus(fileData.id, 'error', { current: 0, total: 1 });
        ocrProcessingRef.current.delete(fileData.id);
        delete ocrWebSocketsRef.current[fileData.id];
        
        // 연결 실패 시 명확한 메시지 표시 (사용자에게는 여전히 표시)
        showNotification(
          `OCR 서버 연결 실패: 백엔드 서버가 실행 중인지 확인해주세요`, 
          'error'
        );
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket 연결 종료:', fileData.name, 'Clean:', event.wasClean, 'Code:', event.code);
        
        // 정상 완료인 경우에만 완료 상태로 변경
        if (event.wasClean && (event.code === 1000 || event.code === 1005)) {
          const currentState = ocrStateManager.getState(fileData.id);
          if (currentState && currentState.status === 'processing') {
            console.log('정상 완료로 OCR 상태 업데이트:', fileData.name);
            updateOCRStatus(fileData.id, 'completed', { current: 1, total: 1 });
          }
        } else if (event.code === 1006) {
          // 1006: 비정상 종료 - 네트워크 문제나 서버 오류
          console.warn('WebSocket 비정상 종료:', fileData.name, 'Code:', event.code);
          const currentState = ocrStateManager.getState(fileData.id);
          
          // 처리 중이었다면 재시도 또는 오류 처리
          if (currentState && currentState.status === 'processing') {
            updateOCRStatus(fileData.id, 'error', { current: 0, total: 1 });
            showNotification(
              `${fileData.name} OCR 처리 중 연결이 끊어졌습니다. 네트워크를 확인하고 다시 시도해주세요.`, 
              'error'
            );
          } else if (currentState && currentState.status === 'connecting') {
            updateOCRStatus(fileData.id, 'error', { current: 0, total: 1 });
            showNotification(
              `${fileData.name} OCR 서버 연결에 실패했습니다. 서버 상태를 확인해주세요.`, 
              'error'
            );
          }
        } else if (!event.wasClean) {
          // 기타 비정상 종료
          console.warn('WebSocket 비정상 종료:', fileData.name, 'Code:', event.code);
          const currentState = ocrStateManager.getState(fileData.id);
          if (currentState && ['connecting', 'processing'].includes(currentState.status)) {
            updateOCRStatus(fileData.id, 'error', { current: 0, total: 1 });
            showNotification(`${fileData.name} OCR 처리가 중단되었습니다.`, 'error');
          }
        }
        
        // 리소스 정리
        ocrProcessingRef.current.delete(fileData.id);
        if (ocrWebSocketsRef.current[fileData.id] === ws) {
          delete ocrWebSocketsRef.current[fileData.id];
        }
      };

    } catch (error) {
      // 개발 환경에서는 로그 레벨을 낮춤
      if (process.env.NODE_ENV === 'development') {
        console.debug('WebSocket 생성 실패:', fileData.name, error.message);
      } else {
        console.error('WebSocket 생성 실패:', fileData.name, error);
      }
      
      updateOCRStatus(fileData.id, 'error', { current: 0, total: 1 });
      ocrProcessingRef.current.delete(fileData.id);
      delete ocrWebSocketsRef.current[fileData.id];
      showNotification(
        `WebSocket 생성 실패: ${error.message} - 네트워크 설정을 확인해주세요`, 
        'error'
      );
    }
  };

  // 파일 크기 포맷팅
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 파일 추가 (새 파일 추가 시에만 OCR 중단)
  const handleFileSelect = async (selectedFiles) => {
    // 새 파일이 추가될 때만 기존 OCR 중단
    stopAllOcr();
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const newFiles = Array.from(selectedFiles).map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      extension: file.name.split('.').pop().toLowerCase()
    }));
    
    // 파일 형식 검증
    const supportedExtensions = ['pdf', 'docx'];
    const invalidFiles = newFiles.filter(file => !supportedExtensions.includes(file.extension));
    
    if (invalidFiles.length > 0) {
      setError(`지원되지 않는 파일 형식입니다. PDF 또는 DOCX 파일만 업로드할 수 있습니다.`);
      return;
    }
    
    // 파일 크기 검증
    const maxSize = 50 * 1024 * 1024; // 50MB
    const oversizedFiles = newFiles.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      setError(`파일 크기가 너무 큽니다 (최대 50MB)`);
      return;
    }
    
    const tooSmallFiles = newFiles.filter(file => file.size < 1000);
    
    if (tooSmallFiles.length > 0) {
      setError(`파일이 너무 작습니다 (최소 1KB 필요)`);
      return;
    }
    
    setFiles(prev => [...prev, ...newFiles]);
    setError('');
    
    if (newFiles.length > 0) {
      setViewMode('analysis');
      
      // 자동 처리 실행
      if (autoOcrEnabled) {
        // 백엔드 서버 상태 먼저 확인
        setTimeout(async () => {
          const isBackendAvailable = await checkBackendStatus();
          
          if (!isBackendAvailable) {
            const backendUrl = API_BASE_URL;
            showNotification(
              `백엔드 서버에 연결할 수 없습니다 (${backendUrl}). OCR 기능을 사용하려면 서버를 시작해주세요.`, 
              'error'
            );
            // 서버가 없어도 파일은 업로드되도록 함
            return;
          }
          
          ocrWebSocketsRef.current = {};
          
          newFiles.forEach((fileData, index) => {
            setTimeout(() => {
              if (fileData.file.type === 'application/pdf') {
                // PDF는 OCR WebSocket 사용
                runOcrPreviewWebSocket(fileData);
              } else if (fileData.file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                // DOCX는 직접 텍스트 추출
                extractDocxText(fileData);
              }
            }, index * 100);
          });
        }, 300);
      }
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = e.dataTransfer.files;
    handleFileSelect(droppedFiles);
  };

  // 파일 제거
  const removeFile = (id) => {
    // 진행 중인 OCR 중단
    stopOcrForFile(id);
    
    // PDF 페이지 이미지들 정리
    if (selectedFile?.id === id) {
      pdfPages.forEach(pageUrl => {
        if (pageUrl) URL.revokeObjectURL(pageUrl);
      });
      setPdfPages([]);
    }
    
    setFiles(prev => prev.filter(file => file.id !== id));
    if (selectedFile?.id === id) {
      setSelectedFile(null);
    }
    
    // 전역 OCR 상태에서도 제거
    delete ocrStateManager.states[id];
    
    // 모든 파일이 제거되면 업로드 화면으로 돌아가기
    if (files.length === 1) { // 현재 제거되는 파일이 마지막이면
      setViewMode('upload');
      setSelectedFile(null);
      setSelectedResult(null);
    }
  };

  // 파일 클릭 시 선택/선택해제
  const handleFileClick = useCallback((fileData) => {
    // 이미 선택된 파일을 다시 클릭하면 선택 해제
    if (selectedFile && selectedFile.id === fileData.id) {
      setSelectedFile(null);
      setSelectedResult(null);
      
      // PDF 페이지 이미지들만 정리
      if (pdfPages.length > 0) {
        const pagesToClean = [...pdfPages];
        setPdfPages([]);
        setPageNumber(1);
        setNumPages(null);
        
        // 메모리 정리는 비동기로
        setTimeout(() => {
          pagesToClean.forEach(pageUrl => {
            if (pageUrl) URL.revokeObjectURL(pageUrl);
          });
        }, 50);
      }
      return;
    }
    
    // 새 파일 선택
    setSelectedFile(fileData);
    
    // 기존 변환 결과 확인
    const existingResult = convertedFiles.find(f => f.originalFile === fileData.name);
    setSelectedResult(existingResult || null);
    
    // PDF 파일인 경우 페이지 변환 실행
    if (fileData.file && fileData.file.type === 'application/pdf') {
      // 기존 PDF 페이지 정리
      const oldPages = [...pdfPages];
      setPdfPages([]);
      setPageNumber(1);
      setNumPages(null);
      
      // 메모리 정리
      if (oldPages.length > 0) {
        setTimeout(() => {
          oldPages.forEach(pageUrl => {
            if (pageUrl) URL.revokeObjectURL(pageUrl);
          });
        }, 10);
      }
      
      // PDF 이미지 변환 실행
      setTimeout(() => {
        convertPdfToImages(fileData.file);
      }, 100);
    }
  }, [selectedFile, pdfPages, convertedFiles, convertPdfToImages]);

  // 페이지 이동 함수
  const goToPreviousPage = () => {
    setPageNumber(Math.max(1, pageNumber - 1));
  };

  const goToNextPage = () => {
    setPageNumber(Math.min(numPages || 1, pageNumber + 1));
  };

  // 파일 변환 처리
  const handleConvert = async (fileData, format) => {
    if (format === selectedProductType || ['채권선도', 'FRN'].includes(format)) {
      await convertPdfToJson(fileData, format);
    }
  };

  // 파일 아이템 컴포넌트
  const FileItem = React.memo(({ fileData, isSelected, onFileClick, onRemove, formatFileSize }) => {
    // 해당 파일의 OCR 상태만 구독
    const initialStateRef = useRef(ocrStateManager.getState(fileData.id));
    const [ocrState, setOcrState] = useState(initialStateRef.current);
    
    // OCR 상태 변경 구독
    React.useEffect(() => {
      // 현재 상태로 즉시 동기화
      const currentState = ocrStateManager.getState(fileData.id);
      if (JSON.stringify(currentState) !== JSON.stringify(ocrState)) {
        setOcrState(currentState);
      }
      
      // 이후 변경사항 구독
      const unsubscribe = ocrStateManager.subscribe((fileId, newState) => {
        if (fileId === fileData.id && newState) {
          // 상태가 실제로 변경된 경우에만 업데이트
          setOcrState(prevState => {
            if (JSON.stringify(prevState) !== JSON.stringify(newState)) {
              return newState;
            }
            return prevState;
          });
        }
      });
      
      return unsubscribe;
    }, [fileData.id]);

    // OCR 진행률 계산
    const progressPercentage = useMemo(() => {
      if (!ocrState?.progress) return 0;
      const { current = 0, total = 1 } = ocrState.progress;
      return Math.max(5, Math.min(100, (current / total) * 100));
    }, [ocrState?.progress]);

    // 진행률 설명 텍스트
    const progressDescription = useMemo(() => {
      if (!ocrState?.progress) return '';
      const { current = 0, total = 1, step_description } = ocrState.progress;
      
      if (step_description) {
        return `${step_description} (${current}/${total})`;
      }
      
      if (current === 0) return '대기 중...';
      if (current === 1) return '파일 불러오기 완료';
      return `페이지 ${current - 1} 완료 (${current}/${total})`;
    }, [ocrState?.progress]);

    // 클릭 핸들러
    const handleClick = useCallback((e) => {
      e.stopPropagation();
      onFileClick(fileData);
    }, [fileData, onFileClick]);

    const handleRemove = useCallback((e) => {
      e.stopPropagation();
      onRemove(fileData.id);
    }, [fileData.id, onRemove]);

    return (
      <div 
        className={`file-item-sidebar ${isSelected ? 'selected' : ''}`}
        onClick={handleClick}
      >
        <div className={`file-checkbox ${isSelected ? 'checked' : ''}`}>
          {isSelected ? '✓' : '□'}
        </div>
        <div className="file-details">
          <h4>{fileData.name}</h4>
          <p>{formatFileSize(fileData.size)}</p>
          
          {/* OCR 상태 표시 */}
          <div className={`ocr-status-sidebar ${ocrState?.status || 'pending'}`}>
            {ocrState?.status === 'connecting' && (
              <div className="ocr-progress-bar">
                <div 
                  className="ocr-progress-fill"
                  style={{ width: '10%' }}
                ></div>
              </div>
            )}
            {ocrState?.status === 'processing' && (
              <div className="ocr-progress-bar">
                <div 
                  className="ocr-progress-fill"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            )}
            {ocrState?.status === 'completed' && (
              <div className="ocr-progress-bar completed">
                <div 
                  className="ocr-progress-fill"
                  style={{ width: '100%' }}
                ></div>
              </div>
            )}
            {ocrState?.status === 'error' && (
              <div className="ocr-progress-bar error">
                <div 
                  className="ocr-progress-fill"
                  style={{ width: '100%' }}
                ></div>
              </div>
            )}
            {ocrState?.status === 'cancelled' && (
              <div className="ocr-progress-bar cancelled">
                <div 
                  className="ocr-progress-fill"
                  style={{ width: '100%' }}
                ></div>
              </div>
            )}
            {(!ocrState || ocrState.status === 'pending') && (
              <div className="ocr-progress-bar pending">
                <div 
                  className="ocr-progress-fill"
                  style={{ width: '0%' }}
                ></div>
              </div>
            )}
          </div>
        </div>
        <button 
          className="remove-file-btn-small"
          onClick={handleRemove}
        >
          ×
        </button>
      </div>
    );
  });

  // 파일 다운로드
  const downloadFile = (file) => {
    const blob = new Blob([file.content], { type: file.type });
    saveAs(blob, file.name);
  };

  // 업로드 화면 렌더링
  const renderUploadView = () => (
    <div className="upload-view">
      <div className="app-header">
        <p className="subtitle">Fn자산평가</p>
        <h1 className="title">LLM 기반 투자설명서 자동 변환 시스템</h1>
        
        {/* 백엔드 서버 상태 인디케이터 */}
        <div className="server-status" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '10px',
          fontSize: '14px'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: backendStatus === 'online' ? '#4CAF50' : 
                           backendStatus === 'offline' ? '#f44336' : '#ff9800',
            marginRight: '6px'
          }}></span>
          OCR 서버: {
            backendStatus === 'online' ? '연결됨' :
            backendStatus === 'offline' ? '연결 실패' : '확인 중...'
          }
          {backendStatus === 'offline' && (
            <button 
              onClick={() => {
                setBackendStatus('unknown');
                checkBackendStatus();
              }}
              style={{
                marginLeft: '8px',
                padding: '2px 8px',
                fontSize: '12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              재시도
            </button>
          )}
        </div>
        
        {/* 서버 시작 가이드 */}
        {backendStatus === 'offline' && (
          <div style={{
            marginTop: '10px',
            padding: '12px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px',
            fontSize: '13px',
            textAlign: 'center',
            maxWidth: '600px',
            margin: '10px auto'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
              💡 OCR 기능을 사용하려면 백엔드 서버를 시작해주세요
            </div>
            <div style={{ color: '#856404' }}>
              터미널에서 <code style={{ background: '#f8f9fa', padding: '2px 4px', borderRadius: '3px' }}>npm start</code> 실행 시 자동으로 백엔드가 시작됩니다
            </div>
            <div style={{ marginTop: '5px', fontSize: '12px', color: '#6c757d' }}>
              또는 수동으로: <code style={{ background: '#f8f9fa', padding: '2px 4px', borderRadius: '3px' }}>./start_backend.sh</code>
            </div>
          </div>
        )}
      </div>

      <div className="upload-container">
        {/* 상품 타입 선택 */}
        <div className="product-selector">
          <select
            value={selectedProductType}
            onChange={(e) => setSelectedProductType(e.target.value)}
          >
            <option value="채권선도">채권선도</option>
            <option value="FRN">FRN</option>
          </select>
        </div>

        {/* 업로드 영역 */}
        <div 
          className={`upload-area-center ${dragOver ? 'dragover' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="upload-icon">⬆</div>
          <div className="upload-text">파일 업로드</div>
          <div className="upload-hint">PDF 또는 DOCX 파일 (최대 50MB)</div>
          <button className="choose-files-btn">파일탐색기</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            multiple
            className="file-input"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>
      </div>
    </div>
  );

  // 분석 화면 렌더링 (3단계 레이아웃)
  const renderAnalysisView = () => (
    <div className="analysis-view">
      <div className="app-header">
        <div className="header-nav">
          <button className="back-btn" onClick={() => {
            // 모든 OCR 중단
            stopAllOcr();
            
            // 파일 목록 및 상태 초기화
            setFiles([]);
            setSelectedFile(null);
            setSelectedResult(null);
            setConvertedFiles([]);
            
            // PDF 페이지 이미지들 정리
            pdfPages.forEach(pageUrl => {
              if (pageUrl) URL.revokeObjectURL(pageUrl);
            });
            setPdfPages([]);
            setPageNumber(1);
            setNumPages(null);
            
            // 업로드 화면으로 이동
            setViewMode('upload');
          }}>
            ← 뒤로
          </button>
          <div>
            <h1 className="title">LLM 기반 투자설명서 자동 변환 시스템</h1>
            <p className="subtitle">파일을 선택하여 분석을 시작하세요</p>
          </div>
        </div>
      </div>

      <div className={`app-content ${!selectedFile ? 'sidebar-only' : ''}`}>
        {/* 사이드바 */}
        <div className="sidebar">
          <div className="sidebar-header">
            <h2>파일 목록</h2>
            <button 
              className="add-files-btn-small"
              onClick={() => fileInputRef.current?.click()}
            >
              + 추가
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              multiple
              className="file-input"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </div>

          {/* 업로드된 파일 목록 */}
          <div className={`file-list-sidebar ${selectedFile ? 'with-selection' : ''}`}>
            {files.map(fileData => {
              const isSelected = selectedFile?.id === fileData.id;
              
              return (
                <FileItem
                  key={fileData.id}
                  fileData={fileData}
                  isSelected={isSelected}
                  onFileClick={handleFileClick}
                  onRemove={removeFile}
                  formatFileSize={formatFileSize}
                />
              );
            })}
          </div>
          
          {/* 사이드바 하단 고정 영역 */}
          <div className="sidebar-bottom">
            {/* 현재 선택된 파일 정보 */}
            {selectedFile && (
              <div className="selected-file-info">
                <h3>선택된 파일</h3>
                <div className="file-info-card">
                  <div className="file-checkbox checked">✓</div>
                  <div>
                    <h4>{selectedFile.name}</h4>
                    <p>{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                
                {!convertedFiles.find(f => f.originalFile === selectedFile.name) && (
                  <button
                    className="analyze-btn"
                    onClick={() => handleConvert(selectedFile, selectedProductType)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? '분석 중...' : '🔍 분석 시작'}
                  </button>
                )}
              </div>
            )}

            {/* 진행률 표시 */}
            {isProcessing && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="progress-text">
                  {processingStep} ({progress}%)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 메인 컨텐츠 영역 - 파일이 선택되었을 때만 표시 */}
        {selectedFile && (
          <div className="main-content">
            {/* 원본 문서 뷰어 */}
            <div className="document-viewer">
              <div className="document-header">
                <h2>원본 문서</h2>
                {selectedFile.type === 'application/pdf' && ocrStatus[selectedFile.id]?.status === 'completed' && (
                  <button 
                    className="view-toggle-btn"
                    onClick={() => {
                      const newMode = documentViewMode === 'image' ? 'text' : 'image';
                      setDocumentViewMode(newMode);
                    }}
                  >
                    {documentViewMode === 'image' ? '텍스트 보기' : '이미지 보기'}
                  </button>
                )}
              </div>
              <div className="document-content">
                {selectedFile.type === 'application/pdf' ? (
                  <div className="pdf-viewer">
                    {documentViewMode === 'image' ? (
                      /* PDF 페이지 이미지 표시 */
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {pdfLoading ? (
                          <div style={{ 
                            width: '400px', 
                            height: '500px', 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            color: '#666'
                          }}>
                            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚙</div>
                            <div>PDF를 이미지로 변환하는 중...</div>
                          </div>
                        ) : pdfPages.length > 0 && pdfPages[pageNumber - 1] ? (
                          <img 
                            src={pdfPages[pageNumber - 1]}
                            alt={`PDF 페이지 ${pageNumber}`}
                            style={{
                              width: '110%',
                              maxWidth: '800px',
                              height: 'auto',
                              border: '1px solid #ddd',
                              borderRadius: '8px',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                              backgroundColor: 'white'
                            }}
                            onError={(e) => {
                              console.error('이미지 로드 실패:', e);
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : error && error.includes('PDF를 이미지로 변환') ? (
                          <div style={{ 
                            width: '400px', 
                            height: '500px', 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            color: '#666',
                            padding: '20px',
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '48px', marginBottom: '20px' }}>📄</div>
                            <div style={{ marginBottom: '15px' }}>PDF 이미지 변환에 실패했습니다</div>
                            <div style={{ fontSize: '14px', color: '#888' }}>
                              OCR 분석 결과를 텍스트 모드에서 확인하세요
                            </div>
                            {ocrStatus[selectedFile.id]?.status === 'completed' && (
                              <button 
                                style={{
                                  marginTop: '15px',
                                  padding: '8px 16px',
                                  background: '#007bff',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                                onClick={() => setDocumentViewMode('text')}
                              >
                                텍스트 모드로 보기
                              </button>
                            )}
                          </div>
                        ) : (
                          <div style={{ 
                            width: '400px', 
                            height: '500px', 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            color: '#666'
                          }}>
                            <div style={{ fontSize: '48px', marginBottom: '20px' }}>📄</div>
                            <div>PDF 파일을 처리하는 중...</div>
                            {ocrStatus[selectedFile.id]?.status === 'processing' && (
                              <div style={{ marginTop: '10px', fontSize: '14px', color: '#888' }}>
                                OCR 분석이 완료되면 미리보기가 가능합니다
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* 텍스트 모드 표시 (하이라이트 포함) */
                      <div className="text-viewer">
                        {(() => {
                          const fileOcrStatus = ocrStatus[selectedFile.id];
                          console.log('텍스트 모드 OCR 상태:', fileOcrStatus);
                          
                          if (!fileOcrStatus) {
                            return (
                              <div className="text-content">
                                OCR 상태를 확인하는 중...
                              </div>
                            );
                          }
                          
                          if (fileOcrStatus.status === 'completed') {
                            const ocrResult = fileOcrStatus.result;
                            console.log('OCR 결과:', ocrResult);
                            
                            let displayText = '';
                            
                            if (ocrResult) {
                              // 페이지별 결과가 있는 경우
                              if (ocrResult.page_results && Array.isArray(ocrResult.page_results)) {
                                const currentPageResult = ocrResult.page_results.find(p => p.page === pageNumber);
                                if (currentPageResult && currentPageResult.text) {
                                  displayText = currentPageResult.text;
                                }
                              }
                              
                              // 전체 텍스트 결과
                              if (!displayText && ocrResult.full_text) {
                                displayText = ocrResult.full_text;
                              }
                              
                              // 미리보기 텍스트
                              if (!displayText && ocrResult.preview_text) {
                                displayText = ocrResult.preview_text;
                              }
                              
                              // 기본 text 필드
                              if (!displayText && ocrResult.text) {
                                displayText = ocrResult.text;
                              }
                            }
                            
                            if (displayText) {
                              // 매핑 정보가 있으면 하이라이트와 함께 표시
                              const hasMapping = fieldMappings && fieldMappings.length > 0;
                              
                              return hasMapping ? (
                                <TextHighlighter
                                  text={displayText}
                                  fieldMappings={fieldMappings}
                                  selectedField={null}
                                  onFieldSelect={(field) => {
                                    console.log('선택된 필드:', field);
                                  }}
                                />
                              ) : (
                                <div className="text-content">
                                  <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                                    {displayText}
                                  </pre>
                                </div>
                              );
                            }
                            
                            return (
                              <div className="text-content">
                                OCR 완료되었으나 텍스트 데이터가 없습니다.
                              </div>
                            );
                          } else if (fileOcrStatus.status === 'processing') {
                            return (
                              <div className="text-content">
                                OCR 분석 중...
                              </div>
                            );
                          } else if (fileOcrStatus.status === 'connecting') {
                            return (
                              <div className="text-content">
                                OCR 서버에 연결 중...
                              </div>
                            );
                          } else if (fileOcrStatus.status === 'error') {
                            return (
                              <div className="text-content">
                                OCR 처리 중 오류가 발생했습니다.
                              </div>
                            );
                          }
                          
                          return (
                            <div className="text-content">
                              OCR 결과를 불러오는 중...
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* PDF 네비게이션 - 이미지 뷰에서만 표시 */}
                    {pdfPages.length > 0 && documentViewMode === 'image' && (
                      <div className="pdf-controls" style={{ marginTop: '10px' }}>
                        <div className="pdf-navigation">
                          <button 
                            onClick={goToPreviousPage}
                            disabled={pageNumber <= 1}
                            className="pdf-nav-btn"
                          >
                            ◀ 이전
                          </button>
                          <span className="page-info">
                            {pageNumber} / {numPages || '?'}
                          </span>
                          <button 
                            onClick={goToNextPage}
                            disabled={pageNumber >= (numPages || 1)}
                            className="pdf-nav-btn"
                          >
                            다음 ▶
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? (
                  /* DOCX 파일 처리 (하이라이트 포함) */
                  <div className="docx-viewer">
                    <div className="text-viewer">
                      {(() => {
                        const fileOcrStatus = ocrStatus[selectedFile.id];
                        
                        if (fileOcrStatus?.status === 'completed') {
                          const displayText = fileOcrStatus?.result?.preview_text || fileOcrStatus?.result?.full_text;
                          
                          if (displayText) {
                            // 매핑 정보가 있으면 하이라이트와 함께 표시
                            const hasMapping = fieldMappings && fieldMappings.length > 0;
                            
                            return hasMapping ? (
                              <TextHighlighter
                                text={displayText}
                                fieldMappings={fieldMappings}
                                selectedField={null}
                                onFieldSelect={(field) => {
                                  console.log('DOCX에서 선택된 필드:', field);
                                }}
                              />
                            ) : (
                              <div className="text-content">
                                <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                                  {displayText}
                                </pre>
                              </div>
                            );
                          } else {
                            return (
                              <div className="text-content">
                                텍스트를 불러올 수 없습니다.
                              </div>
                            );
                          }
                        } else if (fileOcrStatus?.status === 'processing') {
                          return (
                            <div className="text-content">
                              텍스트를 추출하는 중...
                            </div>
                          );
                        } else {
                          return (
                            <div className="text-content">
                              DOCX 파일 텍스트 추출을 위해 OCR을 실행하세요.
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="document-placeholder">
                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>
                      {selectedFile.extension === 'docx' ? '📄' : '□'}
                    </div>
                    <p><strong>{selectedFile.extension === 'docx' ? 'DOCX' : '지원되는'} 파일을 선택하면 미리보기가 표시됩니다</strong></p>
                    <div style={{ marginTop: '20px', fontSize: '14px', backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
                      <p><strong>파일명:</strong> {selectedFile.name}</p>
                      <p><strong>크기:</strong> {formatFileSize(selectedFile.size)}</p>
                      <p><strong>타입:</strong> {selectedFile.type}</p>
                      <p><strong>확장자:</strong> {selectedFile.extension?.toUpperCase()}</p>
                    </div>

                  </div>
                )}
              </div>
            </div>

            {/* JSON 결과 뷰어 */}
            <div className="result-viewer">
              <h2>JSON 변환 결과</h2>
              {selectedResult ? (
                <div>
                  <div className="result-content">
                    <pre>{selectedResult.content}</pre>
                  </div>
                  <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <button 
                      className="download-btn"
                      onClick={() => downloadFile(selectedResult)}
                    >
                      JSON 다운로드
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div style={{ fontSize: '48px', marginBottom: '20px' }}>{ }</div>
                  <p>분석을 시작하면 JSON 데이터가 표시됩니다</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // 메인 렌더링
  return (
    <div className="App">
      {/* 알림 */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* 뷰 모드에 따른 렌더링 */}
      {viewMode === 'upload' && renderUploadView()}
      {viewMode === 'analysis' && renderAnalysisView()}

      {/* 에러 메시지 */}
      {error && (
        <div className="error-notification">
          ❌ {error}
        </div>
      )}
    </div>
  );
};

export default FileConverter;