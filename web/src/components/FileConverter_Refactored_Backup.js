import React, { useState, useEffect } from 'react';

// Custom Hooks
import useBackendStatus from '../hooks/useBackendStatus';
import useNotification from '../hooks/useNotification';
import useOCRManager from '../hooks/useOCRManager';
import useFileManagement from '../hooks/useFileManagement';
import usePDFViewer from '../hooks/usePDFViewer';
import useFileConverter from '../hooks/useFileConverter';

// Components
import FileUploadArea from './FileConverter/FileUploadArea';
import FileList from './FileConverter/FileList';
import PDFViewer from './FileConverter/PDFViewer';
import ConversionResults from './FileConverter/ConversionResults';
import ProductTypeSelector from './FileConverter/ProductTypeSelector';

// Utilities
import { getApiBaseUrl } from '../utils/apiUtils';

/**
 * Refactored FileConverter Component
 * Main container component using modular architecture with custom hooks and sub-components
 */
const FileConverter = () => {
  // View mode state
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
    runOcrPreviewWebSocket
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
      // Production 환경에서만 정리 작업 수행
      if (process.env.NODE_ENV === 'production') {
        console.log('FileConverter unmount - cleaning up OCR processes');
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
      
      // 업로드된 PDF 파일들에 대해 자동으로 OCR 실행
      uploadResult.addedFiles.forEach(fileData => {
        if (fileData.file.type === 'application/pdf') {
          console.log('Auto-starting OCR for uploaded PDF:', fileData.name);
          runOcrPreviewWebSocket(fileData);
        }
      });
    }
    if (uploadResult.errorCount > 0) {
      showError(`${uploadResult.errorCount} file(s) failed validation.`);
    }
  };

  // Render different views based on viewMode
  if (viewMode === 'upload') {
    return (
      <UploadView
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
        files={files}
        onFileClick={handleFileClick}
        onFileRemove={handleFileRemove}
        ocrStatus={ocrStatus}
        selectedProductType={selectedProductType}
        onProductTypeChange={setSelectedProductType}
        notification={notification}
        backendStatus={backendStatus}
        isOnline={isOnline}
        hasFiles={hasFiles}
      />
    );
  }

  return (
    <AnalysisView
      selectedFile={selectedFile}
      files={files}
      onBackToUpload={handleBackToUpload}
      onFileClick={handleFileClick}
      onFileRemove={handleFileRemove}
      onConvert={handleConvert}
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
      convertedFiles={convertedFiles}
      selectedResult={selectedResult}
      onSelectResult={selectResult}
      onRemoveResult={removeResult}
      isProcessing={isProcessing}
      processingStep={processingStep}
      progress={progress}
      selectedProductType={selectedProductType}
      onProductTypeChange={setSelectedProductType}
      ocrStatus={ocrStatus}
      notification={notification}
    />
  );
};

/**
 * Upload View Component
 */
const UploadView = ({
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileInputChange,
  files,
  onFileClick,
  onFileRemove,
  ocrStatus,
  selectedProductType,
  onProductTypeChange,
  notification,
  backendStatus,
  isOnline,
  hasFiles
}) => (
  <div className="upload-view">
    <div className="upload-container">
      <div className="header">
        <h1 className="title">PDF to JSON Converter</h1>
        <p className="subtitle">Convert financial documents to structured JSON</p>
      </div>

      <ProductTypeSelector
        selectedProductType={selectedProductType}
        onProductTypeChange={onProductTypeChange}
      />

      <FileUploadArea
        dragOver={dragOver}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onFileInputChange={onFileInputChange}
        disabled={!isOnline}
      />

      {hasFiles && (
        <FileList
          files={files}
          onFileClick={onFileClick}
          onFileRemove={onFileRemove}
          ocrStatus={ocrStatus}
        />
      )}

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div className="backend-status">
        Backend: <span className={`status-${backendStatus}`}>{backendStatus}</span>
      </div>
    </div>
  </div>
);

/**
 * Analysis View Component
 */
const AnalysisView = ({
  selectedFile,
  files,
  onBackToUpload,
  onFileClick,
  onFileRemove,
  onConvert,
  pdfPages,
  pageNumber,
  totalPages,
  pdfLoading,
  documentViewMode,
  onConvertPdf,
  onGoToPage,
  onGoToPrevious,
  onGoToNext,
  onToggleViewMode,
  canGoToPrevious,
  canGoToNext,
  convertedFiles,
  selectedResult,
  onSelectResult,
  onRemoveResult,
  isProcessing,
  processingStep,
  progress,
  selectedProductType,
  onProductTypeChange,
  ocrStatus,
  notification
}) => (
  <div className="analysis-view">
    <div className="app-header">
      <div className="header-nav">
        <button className="back-btn" onClick={onBackToUpload}>
          ← Back to Upload
        </button>
        <h1 className="title">Document Analysis</h1>
      </div>
    </div>

    <div className="app-content">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>📁 Files</h2>
        </div>

        <FileList
          files={files}
          onFileClick={onFileClick}
          onFileRemove={onFileRemove}
          ocrStatus={ocrStatus}
        />

        <div className="convert-actions">
          <ProductTypeSelector
            selectedProductType={selectedProductType}
            onProductTypeChange={onProductTypeChange}
            disabled={isProcessing}
          />

          <button
            className="analyze-btn"
            onClick={onConvert}
            disabled={!selectedFile || isProcessing}
          >
            🔄 Convert to JSON
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="document-viewer">
          <PDFViewer
            file={selectedFile?.file}
            pdfPages={pdfPages}
            pageNumber={pageNumber}
            totalPages={totalPages}
            pdfLoading={pdfLoading}
            documentViewMode={documentViewMode}
            onConvertPdf={onConvertPdf}
            onGoToPage={onGoToPage}
            onGoToPrevious={onGoToPrevious}
            onGoToNext={onGoToNext}
            onToggleViewMode={onToggleViewMode}
            canGoToPrevious={canGoToPrevious}
            canGoToNext={canGoToNext}
          />
        </div>

        <div className="result-viewer">
          <ConversionResults
            convertedFiles={convertedFiles}
            selectedResult={selectedResult}
            onSelectResult={onSelectResult}
            onRemoveResult={onRemoveResult}
            isProcessing={isProcessing}
            processingStep={processingStep}
            progress={progress}
          />
        </div>
      </div>
    </div>

    {notification && (
      <div className={`notification ${notification.type}`}>
        {notification.message}
      </div>
    )}
  </div>
);

export default FileConverter;