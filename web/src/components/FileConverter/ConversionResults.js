import React from 'react';
import { saveAs } from 'file-saver';

/**
 * ConversionResults Component
 * Displays conversion results and download options
 */
const ConversionResults = ({ 
  convertedFiles,
  selectedResult,
  onSelectResult,
  onRemoveResult,
  isProcessing,
  processingStep,
  progress,
  className = ''
}) => {
  const handleDownload = (result, format = 'json') => {
    try {
      const data = result.convertedData;
      const fileName = `${result.originalFile.name.replace(/\.[^/.]+$/, '')}_converted`;
      
      if (format === 'json') {
        const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        saveAs(jsonBlob, `${fileName}.json`);
      } else if (format === 'txt') {
        const textContent = JSON.stringify(data, null, 2);
        const textBlob = new Blob([textContent], { type: 'text/plain' });
        saveAs(textBlob, `${fileName}.txt`);
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  const handleDownloadAll = () => {
    convertedFiles.forEach((result, index) => {
      setTimeout(() => {
        handleDownload(result, 'json');
      }, index * 200); // Stagger downloads
    });
  };

  return (
    <div className={`conversion-results ${className}`}>
      {/* Processing Status */}
      {isProcessing && (
        <ProcessingStatus 
          step={processingStep}
          progress={progress}
        />
      )}

      {/* Results Header */}
      {convertedFiles.length > 0 && (
        <div className="result-header">
          <h3>Conversion Results ({convertedFiles.length})</h3>
          {convertedFiles.length > 1 && (
            <button
              className="download-all-btn"
              onClick={handleDownloadAll}
              disabled={isProcessing}
            >
              📥 Download All
            </button>
          )}
        </div>
      )}

      {/* Results List */}
      {convertedFiles.length > 0 ? (
        <div className="results-list">
          {convertedFiles.map((result) => (
            <ResultItem
              key={result.id}
              result={result}
              isSelected={selectedResult && selectedResult.id === result.id}
              onSelect={() => onSelectResult(result.id)}
              onRemove={() => onRemoveResult(result.id)}
              onDownload={(format) => handleDownload(result, format)}
            />
          ))}
        </div>
      ) : !isProcessing && (
        <div className="no-results">
          <div className="no-results-icon">📊</div>
          <p>No conversion results yet.</p>
          <p>Upload and convert files to see results here.</p>
        </div>
      )}

      {/* Selected Result Details */}
      {selectedResult && (
        <ResultDetails
          result={selectedResult}
          onDownload={(format) => handleDownload(selectedResult, format)}
        />
      )}
    </div>
  );
};

/**
 * Processing status indicator
 */
const ProcessingStatus = ({ step, progress }) => (
  <div className="processing-status">
    <div className="processing-header">
      <div className="processing-icon">⚡</div>
      <div className="processing-text">{step}</div>
    </div>
    
    <div className="progress-container">
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="progress-text">{progress}%</div>
    </div>
  </div>
);

/**
 * Individual result item
 */
const ResultItem = ({ 
  result, 
  isSelected, 
  onSelect, 
  onRemove, 
  onDownload 
}) => {
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div 
      className={`result-item ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="file-info">
        <div className="file-icon">📄</div>
        <div className="file-details">
          <h4>{result.originalFile.name}</h4>
          <p>
            {result.productType} • {formatTimestamp(result.timestamp)}
            {result.type === 'mapped' && ' • With Field Mapping'}
          </p>
        </div>
      </div>
      
      <div className="result-actions">
        <button
          className="download-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDownload('json');
          }}
          title="Download JSON"
        >
          📥 JSON
        </button>
        
        <button
          className="download-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDownload('txt');
          }}
          title="Download TXT"
        >
          📝 TXT
        </button>
        
        <button
          className="remove-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove result"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

/**
 * Detailed view of selected result
 */
const ResultDetails = ({ result, onDownload }) => {
  const data = result.convertedData;
  const previewText = JSON.stringify(data, null, 2);
  const maxPreviewLength = 1000;
  const truncatedPreview = previewText.length > maxPreviewLength 
    ? previewText.substring(0, maxPreviewLength) + '...\n}'
    : previewText;

  return (
    <div className="result-details">
      <div className="result-details-header">
        <h4>Conversion Result</h4>
        <div className="result-details-actions">
          <button
            className="btn btn-primary"
            onClick={() => onDownload('json')}
          >
            📥 Download JSON
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onDownload('txt')}
          >
            📝 Download TXT
          </button>
        </div>
      </div>
      
      <div className="result-preview">
        <h5>Preview:</h5>
        <pre className="json-preview">
          {truncatedPreview}
        </pre>
        
        {previewText.length > maxPreviewLength && (
          <p className="preview-notice">
            Preview truncated. Download full file to see complete content.
          </p>
        )}
      </div>
      
      {result.fieldMappings && result.fieldMappings.length > 0 && (
        <div className="field-mappings">
          <h5>Applied Field Mappings:</h5>
          <ul>
            {result.fieldMappings.map((mapping, index) => (
              <li key={index}>
                <strong>{mapping.field}:</strong> {mapping.value}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ConversionResults;