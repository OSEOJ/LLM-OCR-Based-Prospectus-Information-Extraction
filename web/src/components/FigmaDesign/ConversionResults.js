import React from 'react';
import '../../styles/design-system.css';

/**
 * ConversionResults Component
 * 변환 완료 목록 컴포넌트
 * 
 * Features:
 * - 변환 완료된 파일 목록
 * - 다운로드 기능
 * - 선택 상태 표시
 * - 결과 제거
 */
const ConversionResults = ({
  convertedFiles = [],
  selectedResult,
  onSelectResult,
  onRemoveResult,
  isProcessing = false
}) => {
  const truncateFileName = (name, maxLength = 25) => {
    if (name.length <= maxLength) return name;
    const extension = name.split('.').pop();
    const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
    const truncated = nameWithoutExt.substring(0, maxLength - extension.length - 4);
    return `${truncated}...${extension}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDownload = (result, format) => {
    if (!result) return;
    
    const content = format === 'json' ? 
      JSON.stringify(result.convertedData, null, 2) : 
      result.extractedText || '';
    
    const mimeType = format === 'json' ? 'application/json' : 'text/plain';
    const extension = format === 'json' ? 'json' : 'txt';
    const fileName = `${result.fileName.replace(/\.[^/.]+$/, "")}.${extension}`;
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (convertedFiles.length === 0) {
    return (
      <div className="conversion-results-empty">
        <div className="empty-state">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="empty-icon">
            <path 
              d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
          <p className="empty-text">변환 완료된 파일이 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversion-results">
      <div className="results-list">
        {convertedFiles.map((result) => {
          const isSelected = selectedResult && selectedResult.id === result.id;
          
          return (
            <div 
              key={result.id}
              className={`result-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectResult && onSelectResult(result)}
            >
              <div className="result-info">
                <div className="result-header">
                  <span className="result-name" title={result.fileName}>
                    {truncateFileName(result.fileName)}
                  </span>
                  <button
                    className="result-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveResult && onRemoveResult(result.id);
                    }}
                    title="결과 제거"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path 
                        d="M9 3L3 9M3 3L9 9" 
                        stroke="currentColor" 
                        strokeWidth="1.5" 
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
                
                <div className="result-details">
                  <span className="result-date">
                    {formatDate(result.convertedAt)}
                  </span>
                  <span className="result-type">
                    {result.productType?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>
                
                {/* 다운로드 버튼들 */}
                <div className="result-actions">
                  <button
                    className="btn btn-secondary btn-download"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(result, 'json');
                    }}
                    title="JSON 다운로드"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path 
                        d="M7 1V10M7 10L4 7M7 10L10 7M13 10V12C13 12.5523 12.5523 13 12 13H2C1.44772 13 1 12.5523 1 12V10" 
                        stroke="currentColor" 
                        strokeWidth="1.2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                    JSON
                  </button>
                  
                  <button
                    className="btn btn-secondary btn-download"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(result, 'txt');
                    }}
                    title="TXT 다운로드"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path 
                        d="M7 1V10M7 10L4 7M7 10L10 7M13 10V12C13 12.5523 12.5523 13 12 13H2C1.44772 13 1 12.5523 1 12V10" 
                        stroke="currentColor" 
                        strokeWidth="1.2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                    TXT
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConversionResults;