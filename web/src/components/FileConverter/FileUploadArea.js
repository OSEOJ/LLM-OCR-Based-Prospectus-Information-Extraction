import React, { useRef } from 'react';

/**
 * FileUploadArea Component
 * Handles file upload with drag & drop functionality
 */
const FileUploadArea = ({ 
  dragOver, 
  onDragOver, 
  onDragLeave, 
  onDrop, 
  onFileInputChange,
  disabled = false,
  className = ''
}) => {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={`upload-section ${className}`}>
      <div 
        className={`upload-area ${dragOver ? 'dragover' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={handleClick}
      >
        <div className="upload-icon">📁</div>
        <div className="upload-text">
          {dragOver ? 'Drop files here!' : 'Click or drag files here'}
        </div>
        <div className="upload-hint">
          Supports PDF, DOC, DOCX files (Max 50MB)
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          className="file-input"
          onChange={onFileInputChange}
          accept=".pdf,.doc,.docx"
          multiple
          disabled={disabled}
        />
        
        <button 
          type="button" 
          className="btn btn-primary browse-button"
          onClick={handleClick}
          disabled={disabled}
        >
          Browse Files
        </button>
      </div>
    </div>
  );
};

export default FileUploadArea;