import React from 'react';
import OCRProgressIndicator from './OCRProgressIndicator';

/**
 * FileList Component
 * Displays uploaded files with status and actions
 */
const FileList = ({ 
  files, 
  onFileClick, 
  onFileRemove, 
  ocrStatus = {},
  className = '' 
}) => {
  if (files.length === 0) {
    return (
      <div className={`no-files ${className}`}>
        <p>No files uploaded yet. Drop files above to get started.</p>
      </div>
    );
  }

  return (
    <div className={`file-list ${className}`}>
      {files.map((fileData) => (
        <FileListItem
          key={fileData.id}
          fileData={fileData}
          onClick={() => onFileClick(fileData)}
          onRemove={(e) => {
            e.stopPropagation();
            onFileRemove(fileData.id);
          }}
          ocrStatus={ocrStatus[fileData.id]}
        />
      ))}
    </div>
  );
};

/**
 * Individual file list item
 */
const FileListItem = ({ fileData, onClick, onRemove, ocrStatus }) => {
  const getStatusIcon = () => {
    switch (fileData.status) {
      case 'completed': return '✅';
      case 'processing': return '🔄';
      case 'error': return '❌';
      default: return '📄';
    }
  };

  const getStatusText = () => {
    switch (fileData.status) {
      case 'completed': return 'Completed';
      case 'processing': return 'Processing...';
      case 'error': return 'Error';
      default: return 'Uploaded';
    }
  };

  return (
    <div 
      className={`file-item ${fileData.status || ''}`}
      onClick={onClick}
    >
      <div className="file-info">
        <div className="file-icon">{getStatusIcon()}</div>
        <div className="file-details">
          <h4>{fileData.name}</h4>
          <p>
            {fileData.formattedSize} • {fileData.displayType} • {getStatusText()}
          </p>
          {ocrStatus && (
            <OCRProgressIndicator 
              status={ocrStatus} 
              compact={true} 
            />
          )}
        </div>
      </div>
      
      <div className="file-actions">
        <button
          className="remove-file-btn-small"
          onClick={onRemove}
          title="Remove file"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default FileList;