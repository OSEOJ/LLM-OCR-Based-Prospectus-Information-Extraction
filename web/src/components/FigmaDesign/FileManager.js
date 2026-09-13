import React from 'react';
import '../../styles/design-system.css';

/**
 * FileManager Component
 * 파일 목록 관리 컴포넌트
 * 
 * Features:
 * - 파일 목록 표시
 * - OCR 상태 표시
 * - 파일 선택/제거
 * - 진행률 표시
 */
const FileManager = ({
  files = [],
  selectedFile,
  onFileClick,
  onFileRemove,
  ocrStatus = {}
}) => {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusInfo = (fileId) => {
    const status = ocrStatus[fileId];
    if (!status) return { text: 'pending', className: 'status-pending' };
    
    switch (status.status) {
      case 'processing':
        return { 
          text: `처리중 ${status.progress?.percent || 0}%`, 
          className: 'status-processing',
          progress: status.progress?.percent || 0
        };
      case 'completed':
        return { text: '완료', className: 'status-completed' };
      case 'failed':
        return { text: '실패', className: 'status-error' };
      default:
        return { text: '대기', className: 'status-pending' };
    }
  };

  const truncateFileName = (name, maxLength = 30) => {
    if (name.length <= maxLength) return name;
    const extension = name.split('.').pop();
    const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
    const truncated = nameWithoutExt.substring(0, maxLength - extension.length - 4);
    return `${truncated}...${extension}`;
  };

  if (files.length === 0) {
    return (
      <div className="file-manager-empty">
        <div className="empty-state">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="empty-icon">
            <path 
              d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M14 2V8H20" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
          <p className="empty-text">업로드된 파일이 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="file-manager">
      <div className="file-list">
        {files.map((fileData) => {
          const statusInfo = getStatusInfo(fileData.id);
          const isSelected = selectedFile && selectedFile.id === fileData.id;
          
          return (
            <div 
              key={fileData.id}
              className={`file-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onFileClick && onFileClick(fileData)}
            >
              <div className="file-info">
                <div className="file-header">
                  <span className="file-name" title={fileData.name}>
                    {truncateFileName(fileData.name)}
                  </span>
                  <button
                    className="file-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileRemove && onFileRemove(fileData.id);
                    }}
                    title="파일 제거"
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
                
                <div className="file-details">
                  <span className="file-size">{formatFileSize(fileData.size)}</span>
                  <span className={`file-status ${statusInfo.className}`}>
                    {statusInfo.text}
                  </span>
                </div>
                
                {/* 진행률 바 */}
                {statusInfo.progress !== undefined && (
                  <div className="progress-container">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${statusInfo.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FileManager;