import React, { useState, useEffect } from 'react';
import MainUploadArea from './MainUploadArea';
import Sidebar from './Sidebar';
import PDFViewer from './PDFViewer';
import Notifications from './Notifications';

// Import existing hooks from refactored version
import useBackendStatus from '../../hooks/useBackendStatus';
import useNotification from '../../hooks/useNotification';
import useOCRManager from '../../hooks/useOCRManager';
import useFileManagement from '../../hooks/useFileManagement';
import usePDFViewer from '../../hooks/usePDFViewer';
import useFileConverter from '../../hooks/useFileConverter';

// Import utilities
import { getApiBaseUrl } from '../../utils/apiUtils';

// Import styles
import '../../styles/design-system.css';
import './MainUploadArea.css';
import './FigmaFileConverter.css';

/**
 * FigmaFileConverter Component
 * Figma 디자인 기반 완전히 새로운 PDF to JSON 변환기
 * 
 * Features:
 * - 2-화면 레이아웃 (업로드 화면 → 분석 화면)
 * - Figma 디자인 시스템 적용
 * - 모든 기존 기능 유지
 */
const FigmaFileConverter = () => {
  const [viewMode, setViewMode] = useState('upload'); // 'upload', 'analysis'
  
  // Initialize API URLs
  const API_BASE_URL = getApiBaseUrl();

  // Custom hooks
  const { backendStatus, isOnline } = useBackendStatus(API_BASE_URL);
  const { 
    notification, 
    showNotification, 
    showError, 
    showSuccess 
  } = useNotification();
  
  const {
    ocrStatus,
    stopAllOCR,
    runOcrPreviewWebSocket,
    runOcrBatchWebSocket
  } = useOCRManager();
  
  const {
    files,
    selectedFile,
    dragOver,
    removeFile,
    selectFile,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange,
    hasFiles
  } = useFileManagement();
  
  const {
    pdfPages,
    pageNumber,
    totalPages,
    pdfLoading,
    documentViewMode,
    convertPdfToImages,
    goToPage,
    goToPreviousPage,
    goToNextPage,
    toggleViewMode,
    canGoToPrevious,
    canGoToNext,
    clearPDF
  } = usePDFViewer(showNotification);
  
  const {
    selectedProductType,
    convertedFiles,
    selectedResult,
    isProcessing,
    processingStep,
    progress,
    setSelectedProductType,
    convertPdfToJson,
    selectResult,
    removeResult
  } = useFileConverter(showNotification);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (process.env.NODE_ENV === 'production') {
        console.log('FigmaFileConverter unmount - cleaning up OCR processes');
        stopAllOCR();
      }
    };
  }, [stopAllOCR]);

  // Event handlers
  const handleFileClick = (fileData) => {
    selectFile(fileData.id);
    if (fileData.file.type === 'application/pdf') {
      convertPdfToImages(fileData.file);
    }
    if (viewMode === 'upload') {
      setViewMode('analysis');
    }
  };

  const handleFileRemove = (fileId) => {
    removeFile(fileId);
    // If removed file was selected, clear PDF viewer
    if (selectedFile && selectedFile.id === fileId) {
      clearPDF();
    }
  };

  const handleBackToUpload = () => {
    setViewMode('upload');
    clearPDF();
  };

  const handleConvert = async () => {
    if (!selectedFile || isProcessing) return;
    
    try {
      await convertPdfToJson(selectedFile, selectedProductType);
      showSuccess('File converted successfully!');
    } catch (error) {
      showError(`Conversion failed: ${error.message}`);
    }
  };

  const handleFileUpload = (uploadResult) => {
    if (uploadResult.addedCount > 0) {
      showSuccess(`${uploadResult.addedCount} file(s) uploaded successfully!`);
      
      // 업로드된 PDF 파일들에 대해서만 OCR 미리보기 실행
      // DOCX는 텍스트 추출이므로 OCR 불필요
      const pdfs = uploadResult.addedFiles.filter(f => f.file.type === 'application/pdf');

      if (pdfs.length > 1) {
        // 여러 장이면 연결 하나로 묶어 배치 처리한다.
        console.log('Auto-starting batch OCR for uploaded PDFs:', pdfs.length);
        runOcrBatchWebSocket(pdfs);
      } else if (pdfs.length === 1) {
        console.log('Auto-starting OCR preview for uploaded PDF:', pdfs[0].name);
        runOcrPreviewWebSocket(pdfs[0]);
      }
    }
    if (uploadResult.errorCount > 0) {
      showError(`${uploadResult.errorCount} file(s) failed validation.`);
    }
  };

  const handleSidebarFileAdd = () => {
    // 파일 입력 클릭 트리거
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.docx';
    fileInput.multiple = true;
    fileInput.onchange = (e) => {
      const result = handleFileInputChange(e);
      handleFileUpload(result);
    };
    fileInput.click();
  };

  // Upload View
  if (viewMode === 'upload') {
    return (
      <div className="figma-converter-container">
        <div className="figma-upload-view">
          <MainUploadArea
            dragOver={dragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => {
              const result = handleDrop(e);
              handleFileUpload(result);
            }}
            onFileInputChange={(e) => {
              const result = handleFileInputChange(e);
              handleFileUpload(result);
            }}
            selectedProductType={selectedProductType}
            onProductTypeChange={setSelectedProductType}
            disabled={!isOnline}
            hasFiles={hasFiles}
          />
          
          {/* 업로드된 파일이 있으면 하단에 간단한 파일 목록 표시 */}
          {hasFiles && (
            <div className="upload-file-preview">
              <div className="uploaded-files-header">
                <h3>업로드된 파일 ({files.length})</h3>
                <button 
                  className="btn btn-primary"
                  onClick={() => setViewMode('analysis')}
                >
                  분석 화면으로 →
                </button>
              </div>
              <div className="uploaded-files-list">
                {files.slice(0, 3).map((fileData) => (
                  <div 
                    key={fileData.id}
                    className="uploaded-file-item"
                    onClick={() => handleFileClick(fileData)}
                  >
                    <span className="file-name">{fileData.name}</span>
                    <span className={`file-status ${ocrStatus[fileData.id]?.status || 'pending'}`}>
                      {ocrStatus[fileData.id]?.status || 'pending'}
                    </span>
                  </div>
                ))}
                {files.length > 3 && (
                  <div className="uploaded-files-more">
                    그 외 {files.length - 3}개 파일...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <Notifications notification={notification} />
      </div>
    );
  }

  // Analysis View
  return (
    <div className="figma-converter-container">
      <div className="figma-analysis-view">
        {/* 헤더 */}
        <div className="analysis-header">
          <button className="btn btn-secondary back-btn" onClick={handleBackToUpload}>
            ← 업로드 화면으로
          </button>
          <h1 className="analysis-title">문서 분석</h1>
          <div className="header-actions">
            {/* Backend status removed per user request */}
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        <div className="analysis-content">
          {/* PDF 뷰어 */}
          <div className="document-viewer-section">
            <PDFViewer
              file={selectedFile?.file}
              pdfPages={pdfPages}
              pageNumber={pageNumber}
              totalPages={totalPages}
              pdfLoading={pdfLoading}
              documentViewMode={documentViewMode}
              onConvertPdf={convertPdfToImages}
              onGoToPage={goToPage}
              onGoToPrevious={goToPreviousPage}
              onGoToNext={goToNextPage}
              onToggleViewMode={toggleViewMode}
              canGoToPrevious={canGoToPrevious}
              canGoToNext={canGoToNext}
            />
          </div>

          {/* 사이드바 */}
          <Sidebar
            files={files}
            selectedFile={selectedFile}
            onFileClick={handleFileClick}
            onFileRemove={handleFileRemove}
            onFileAdd={handleSidebarFileAdd}
            convertedFiles={convertedFiles}
            selectedResult={selectedResult}
            onSelectResult={selectResult}
            onRemoveResult={removeResult}
            ocrStatus={ocrStatus}
            isProcessing={isProcessing}
            selectedProductType={selectedProductType}
            onProductTypeChange={setSelectedProductType}
            onConvert={handleConvert}
          />
        </div>
      </div>

      <Notifications notification={notification} />
    </div>
  );
};

export default FigmaFileConverter;