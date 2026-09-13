import React from 'react';

const OCRProgressDisplay = ({ ocrState, onCancel }) => {
  const { status, progress, error, filename } = ocrState;

  if (status === 'pending') {
    return null;
  }

  const getStatusMessage = () => {
    switch (status) {
      case 'processing':
        return '📄 OCR 처리 중...';
      case 'complete':
        return '✅ OCR 완료';
      case 'error':
        return '❌ OCR 실패';
      default:
        return '⏳ 대기 중';
    }
  };

  const getProgressPercentage = () => {
    if (!progress || !progress.total) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  const shouldShowProgress = status === 'processing' && progress;

  return (
    <div className=\"ocr-progress-container\">
      <div className=\"ocr-status\">
        <div className=\"status-header\">
          <span className=\"status-icon\">{getStatusMessage()}</span>
          {filename && (
            <span className=\"filename\">{filename}</span>
          )}
        </div>
        
        {shouldShowProgress && (
          <div className=\"progress-details\">
            <div className=\"progress-bar\">
              <div 
                className=\"progress-fill\"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
            
            <div className=\"progress-info\">
              <span className=\"progress-text\">
                {progress.current} / {progress.total} 페이지
              </span>
              <span className=\"progress-percentage\">
                {getProgressPercentage()}%
              </span>
            </div>
            
            {progress.message && (
              <div className=\"progress-message\">
                {progress.message}
              </div>
            )}
            
            {onCancel && (
              <button 
                className=\"cancel-button\"
                onClick={onCancel}
                title=\"OCR 중단\"
              >
                중단
              </button>
            )}
          </div>
        )}
        
        {status === 'error' && error && (
          <div className=\"error-details\" role=\"alert\">
            <div className=\"error-message\">
              {error.message || error}
            </div>
          </div>
        )}
        
        {status === 'complete' && progress && (
          <div className=\"completion-details\">
            <div className=\"completion-stats\">
              <span>성공률: {progress.success_rate?.toFixed(1) || 100}%</span>
              {progress.processing_time && (
                <span>처리 시간: {progress.processing_time.toFixed(1)}초</span>
              )}
            </div>
            
            {progress.page_results && progress.page_results.some(p => p.status === 'error') && (
              <div className=\"failed-pages\">
                <details>
                  <summary>실패한 페이지 ({progress.page_results.filter(p => p.status === 'error').length}개)</summary>
                  <ul>
                    {progress.page_results
                      .filter(p => p.status === 'error')
                      .map((page, index) => (
                        <li key={index}>
                          페이지 {page.page}: {page.error || '알 수 없는 오류'}
                        </li>
                      ))}
                  </ul>
                </details>
              </div>
            )}
          </div>
        )}
      </div>
      
      <style jsx>{`
        .ocr-progress-container {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .status-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 15px;
        }
        
        .status-icon {
          font-size: 16px;
          font-weight: 500;
        }
        
        .filename {
          font-size: 14px;
          color: #666;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .progress-details {
          space-y: 15px;
        }
        
        .progress-bar {
          width: 100%;
          height: 8px;
          background-color: #f0f0f0;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 10px;
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #007bff, #0056b3);
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        
        .progress-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          color: #555;
          margin-bottom: 10px;
        }
        
        .progress-percentage {
          font-weight: 600;
          color: #007bff;
        }
        
        .progress-message {
          font-size: 13px;
          color: #666;
          font-style: italic;
          margin-bottom: 10px;
        }
        
        .cancel-button {
          background: #dc3545;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .cancel-button:hover {
          background: #c82333;
        }
        
        .error-details {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
          border-radius: 4px;
          padding: 10px;
          margin-top: 10px;
        }
        
        .error-message {
          font-size: 14px;
        }
        
        .completion-details {
          margin-top: 10px;
        }
        
        .completion-stats {
          display: flex;
          gap: 20px;
          font-size: 14px;
          color: #28a745;
          margin-bottom: 10px;
        }
        
        .failed-pages {
          margin-top: 10px;
        }
        
        .failed-pages details {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 4px;
          padding: 10px;
        }
        
        .failed-pages summary {
          cursor: pointer;
          font-size: 14px;
          color: #856404;
          font-weight: 500;
        }
        
        .failed-pages ul {
          margin: 10px 0 0 0;
          padding-left: 20px;
        }
        
        .failed-pages li {
          font-size: 13px;
          color: #856404;
          margin-bottom: 5px;
        }
        
        @media (max-width: 768px) {
          .ocr-progress-container {
            padding: 15px;
            margin: 15px 0;
          }
          
          .status-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          
          .filename {
            max-width: 100%;
          }
          
          .progress-info {
            flex-direction: column;
            align-items: flex-start;
            gap: 5px;
          }
          
          .completion-stats {
            flex-direction: column;
            gap: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default OCRProgressDisplay;