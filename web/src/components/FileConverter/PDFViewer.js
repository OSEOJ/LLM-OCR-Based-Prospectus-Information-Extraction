import React, { useEffect } from 'react';

/**
 * PDFViewer Component
 * Displays PDF documents with page navigation
 */
const PDFViewer = ({ 
  file,
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
  textContent = '',
  className = ''
}) => {
  // Auto-convert PDF when file changes
  useEffect(() => {
    if (file && file.type === 'application/pdf' && !pdfLoading && pdfPages.length === 0) {
      onConvertPdf(file);
    }
  }, [file, pdfLoading, pdfPages.length, onConvertPdf]);

  if (!file) {
    return (
      <div className={`pdf-viewer-placeholder ${className}`}>
        <div className="placeholder-content">
          <div className="placeholder-icon">📄</div>
          <p>Select a file to preview</p>
        </div>
      </div>
    );
  }

  if (file.type !== 'application/pdf') {
    return (
      <div className={`pdf-viewer-placeholder ${className}`}>
        <div className="placeholder-content">
          <div className="placeholder-icon">📄</div>
          <h3>{file.name}</h3>
          <p>Document preview not available for {file.type}</p>
          <p>File size: {file.size ? Math.round(file.size / 1024) : 'Unknown'} KB</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`pdf-viewer ${className}`}>
      <PDFHeader 
        fileName={file.name}
        pageNumber={pageNumber}
        totalPages={totalPages}
        documentViewMode={documentViewMode}
        onGoToPage={onGoToPage}
        onGoToPrevious={onGoToPrevious}
        onGoToNext={onGoToNext}
        onToggleViewMode={onToggleViewMode}
        canGoToPrevious={canGoToPrevious}
        canGoToNext={canGoToNext}
      />
      
      <PDFContent
        pdfLoading={pdfLoading}
        pdfPages={pdfPages}
        pageNumber={pageNumber}
        documentViewMode={documentViewMode}
        textContent={textContent}
      />
    </div>
  );
};

/**
 * PDF Header with navigation controls
 */
const PDFHeader = ({ 
  fileName, 
  pageNumber, 
  totalPages, 
  documentViewMode,
  onGoToPage,
  onGoToPrevious,
  onGoToNext,
  onToggleViewMode,
  canGoToPrevious,
  canGoToNext
}) => {
  const handlePageInputChange = (e) => {
    const value = parseInt(e.target.value);
    if (value >= 1 && value <= totalPages) {
      onGoToPage(value);
    }
  };

  return (
    <div className="pdf-header">
      <h3 className="pdf-title">{fileName}</h3>
      
      <div className="pdf-controls">
        {totalPages > 0 && (
          <div className="page-controls">
            <button
              className="pdf-nav-btn"
              onClick={onGoToPrevious}
              disabled={!canGoToPrevious}
              title="Previous page"
            >
              ‹ Prev
            </button>
            
            <div className="page-info">
              <input
                type="number"
                min="1"
                max={totalPages}
                value={pageNumber}
                onChange={handlePageInputChange}
                className="page-number-input"
              />
              <span> / {totalPages}</span>
            </div>
            
            <button
              className="pdf-nav-btn"
              onClick={onGoToNext}
              disabled={!canGoToNext}
              title="Next page"
            >
              Next ›
            </button>
          </div>
        )}
        
        <div className="view-controls">
          <button
            className="btn btn-secondary"
            onClick={onToggleViewMode}
            title={`Switch to ${documentViewMode === 'image' ? 'text' : 'image'} view`}
          >
            {documentViewMode === 'image' ? '📝 Text' : '🖼️ Image'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * PDF Content area
 */
const PDFContent = ({ 
  pdfLoading, 
  pdfPages, 
  pageNumber, 
  documentViewMode, 
  textContent 
}) => {
  if (pdfLoading) {
    return (
      <div className="pdf-content">
        <div className="loading-state">
          <div className="loading-spinner" />
          <div className="loading-text">Loading PDF...</div>
        </div>
      </div>
    );
  }

  if (documentViewMode === 'text' && textContent) {
    return (
      <div className="pdf-content">
        <div className="text-mode">
          {textContent}
        </div>
      </div>
    );
  }

  if (pdfPages.length === 0) {
    return (
      <div className="pdf-content">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <div className="error-message">Failed to load PDF pages</div>
          <div className="error-details">Please try uploading the file again</div>
        </div>
      </div>
    );
  }

  const currentPageUrl = pdfPages[pageNumber - 1];

  return (
    <div className="pdf-content">
      <div className="pdf-page">
        {currentPageUrl ? (
          <img
            src={currentPageUrl}
            alt={`Page ${pageNumber}`}
            className="pdf-canvas fade-in"
          />
        ) : (
          <div className="error-state">
            <div className="error-message">Failed to load page {pageNumber}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFViewer;