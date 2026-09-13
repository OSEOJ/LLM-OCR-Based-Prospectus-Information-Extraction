import React, { useEffect } from 'react';
import '../../styles/design-system.css';

/**
 * PDFViewer Component
 * Figma 디자인 기반 PDF 뷰어 컴포넌트
 * 
 * Features:
 * - PDF 페이지 렌더링
 * - 페이지 네비게이션
 * - 뷰 모드 전환
 * - 로딩 상태 표시
 */
const PDFViewer = ({
  file,
  pdfPages = [],
  pageNumber = 1,
  totalPages = 0,
  pdfLoading = false,
  documentViewMode = 'image',
  onConvertPdf,
  onGoToPage,
  onGoToPrevious,
  onGoToNext,
  onToggleViewMode,
  canGoToPrevious = false,
  canGoToNext = false
}) => {
  // 파일이 선택되면 자동으로 PDF 로드
  useEffect(() => {
    if (file && onConvertPdf && pdfPages.length === 0 && !pdfLoading) {
      console.log('Auto-loading PDF:', file.name);
      onConvertPdf(file);
    }
  }, [file, onConvertPdf, pdfPages.length, pdfLoading]);

  const handlePageInput = (e) => {
    const page = parseInt(e.target.value);
    if (page >= 1 && page <= totalPages && onGoToPage) {
      onGoToPage(page);
    }
  };

  if (!file) {
    return (
      <div className="pdf-viewer">
        <div className="pdf-viewer-empty">
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="empty-icon">
              <path 
                d="M28 4H12C10.8954 4 10 4.89543 10 6V42C10 43.1046 10.8954 44 12 44H36C37.1046 44 38 43.1046 38 42V16L28 4Z" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M28 4V16H38" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M18 22H30M18 28H30M18 34H24" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round"
              />
            </svg>
            <h3 className="empty-title">문서를 선택해주세요</h3>
            <p className="empty-text">
              좌측에서 PDF 파일을 선택하면<br />
              여기에서 문서를 미리 볼 수 있습니다
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      {/* PDF 뷰어 헤더 */}
      <div className="pdf-viewer-header">
        <div className="document-info">
          <h3 className="document-title" title={file.name}>
            {file.name}
          </h3>
          <span className="document-size">
            {(file.size / (1024 * 1024)).toFixed(2)} MB
          </span>
        </div>

        <div className="viewer-controls">
          {/* 뷰 모드 전환 */}
          <div className="view-mode-toggle">
            <button
              className={`btn btn-secondary ${documentViewMode === 'image' ? 'active' : ''}`}
              onClick={() => onToggleViewMode && onToggleViewMode('image')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path 
                  d="M2 4C2 3.44772 2.44772 3 3 3H13C13.5523 3 14 3.44772 14 4V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4Z" 
                  stroke="currentColor" 
                  strokeWidth="1.2"
                />
                <path 
                  d="M6 7L8 9L12 5" 
                  stroke="currentColor" 
                  strokeWidth="1.2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
              이미지
            </button>
            <button
              className={`btn btn-secondary ${documentViewMode === 'text' ? 'active' : ''}`}
              onClick={() => onToggleViewMode && onToggleViewMode('text')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path 
                  d="M4 4H12M4 8H12M4 12H8" 
                  stroke="currentColor" 
                  strokeWidth="1.2" 
                  strokeLinecap="round"
                />
              </svg>
              텍스트
            </button>
          </div>

          {/* PDF 로드 버튼 제거 - 자동 로드로 변경 */}
        </div>
      </div>

      {/* PDF 콘텐츠 */}
      <div className="pdf-viewer-content">
        {pdfLoading ? (
          <div className="pdf-loading">
            <div className="loading-spinner"></div>
            <p>PDF를 로딩중입니다...</p>
          </div>
        ) : file && pdfPages.length > 0 ? (
          <>
            {/* 페이지 네비게이션 */}
            {totalPages > 1 && (
              <div className="pdf-navigation">
                <button
                  className="btn btn-secondary nav-btn"
                  onClick={onGoToPrevious}
                  disabled={!canGoToPrevious}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path 
                      d="M10 12L6 8L10 4" 
                      stroke="currentColor" 
                      strokeWidth="1.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <div className="page-info">
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={pageNumber}
                    onChange={handlePageInput}
                    className="page-input"
                  />
                  <span className="page-total">/ {totalPages}</span>
                </div>

                <button
                  className="btn btn-secondary nav-btn"
                  onClick={onGoToNext}
                  disabled={!canGoToNext}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path 
                      d="M6 4L10 8L6 12" 
                      stroke="currentColor" 
                      strokeWidth="1.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )}

            {/* PDF 페이지 표시 */}
            <div className="pdf-page-container">
              {documentViewMode === 'image' && pdfPages[pageNumber - 1] ? (
                <img
                  src={pdfPages[pageNumber - 1]}
                  alt={`Page ${pageNumber}`}
                  className="pdf-page-image"
                />
              ) : documentViewMode === 'text' ? (
                <div className="pdf-text-content">
                  <div className="text-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path 
                        d="M6 6H18M6 10H18M6 14H12" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round"
                      />
                    </svg>
                    <p>텍스트 모드는 OCR 완료 후 사용 가능합니다</p>
                  </div>
                </div>
              ) : (
                <div className="pdf-fallback">
                  <p>페이지를 로드할 수 없습니다</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="pdf-viewer-placeholder">
            <div className="placeholder-content">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="placeholder-icon">
                <path 
                  d="M38 8H16C14.8954 8 14 8.89543 14 10V54C14 55.1046 14.8954 56 16 56H48C49.1046 56 50 55.1046 50 54V20L38 8Z" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M38 8V20H50" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M24 28H40M24 36H40M24 44H32" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round"
                />
              </svg>
              <h3>PDF 미리보기</h3>
              <p>PDF 문서를 자동으로 로딩중입니다...<br />잠시만 기다려주세요</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFViewer;