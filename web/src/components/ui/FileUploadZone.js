import React, { useRef } from 'react';
import { useFileUpload } from '../hooks/useFileUpload';

const FileUploadZone = ({ onFileSelected, disabled = false }) => {
  const fileInputRef = useRef(null);
  
  const {
    isDragOver,
    uploadError,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleInputChange,
    clearError
  } = useFileUpload(onFileSelected);

  const handleZoneClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className=\"file-upload-container\">
      <div
        className={`file-upload-zone ${isDragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleZoneClick}
        role=\"button\"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleZoneClick();
          }
        }}
        aria-label=\"파일 업로드 영역\"
      >
        <input
          ref={fileInputRef}
          type=\"file\"
          accept=\".pdf,.docx\"
          onChange={handleInputChange}
          style={{ display: 'none' }}
          disabled={disabled}
        />
        
        <div className=\"upload-icon\">
          📄
        </div>
        
        <div className=\"upload-text\">
          <h3>파일을 여기에 드롭하거나 클릭하여 선택</h3>
          <p>PDF 또는 DOCX 파일 (최대 50MB)</p>
        </div>
        
        {isDragOver && (
          <div className=\"drag-overlay\">
            <div className=\"drag-message\">
              파일을 놓아주세요
            </div>
          </div>
        )}
      </div>
      
      {uploadError && (
        <div className=\"upload-error\" role=\"alert\">
          <span className=\"error-icon\">⚠️</span>
          <span className=\"error-message\">{uploadError}</span>
          <button 
            className=\"error-close\"
            onClick={clearError}
            aria-label=\"오류 메시지 닫기\"
          >
            ×
          </button>
        </div>
      )}
      
      <style jsx>{`
        .file-upload-container {
          width: 100%;
          margin-bottom: 20px;
        }
        
        .file-upload-zone {
          position: relative;
          border: 2px dashed #ccc;
          border-radius: 8px;
          padding: 60px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          background: #fafafa;
          min-height: 200px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        
        .file-upload-zone:hover:not(.disabled) {
          border-color: #007bff;
          background: #f0f8ff;
        }
        
        .file-upload-zone.drag-over {
          border-color: #28a745;
          background: #f0fff0;
          transform: scale(1.02);
        }
        
        .file-upload-zone.disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background: #f5f5f5;
        }
        
        .upload-icon {
          font-size: 48px;
          margin-bottom: 20px;
          opacity: 0.7;
        }
        
        .upload-text h3 {
          margin: 0 0 10px 0;
          color: #333;
          font-size: 18px;
          font-weight: 500;
        }
        
        .upload-text p {
          margin: 0;
          color: #666;
          font-size: 14px;
        }
        
        .drag-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(40, 167, 69, 0.1);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        
        .drag-message {
          background: #28a745;
          color: white;
          padding: 10px 20px;
          border-radius: 4px;
          font-weight: 500;
        }
        
        .upload-error {
          display: flex;
          align-items: center;
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
          border-radius: 4px;
          padding: 10px 15px;
          margin-top: 10px;
          font-size: 14px;
        }
        
        .error-icon {
          margin-right: 10px;
          font-size: 16px;
        }
        
        .error-message {
          flex: 1;
        }
        
        .error-close {
          background: none;
          border: none;
          color: #721c24;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          margin-left: 10px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .error-close:hover {
          background: rgba(114, 28, 36, 0.1);
          border-radius: 2px;
        }
        
        @media (max-width: 768px) {
          .file-upload-zone {
            padding: 40px 15px;
            min-height: 150px;
          }
          
          .upload-icon {
            font-size: 36px;
            margin-bottom: 15px;
          }
          
          .upload-text h3 {
            font-size: 16px;
          }
          
          .upload-text p {
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
};

export default FileUploadZone;