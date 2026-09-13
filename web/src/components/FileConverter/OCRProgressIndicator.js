import React, { useMemo } from 'react';

/**
 * OCRProgressIndicator Component
 * Displays OCR processing status and progress
 */
const OCRProgressIndicator = ({ 
  status, 
  compact = false, 
  className = '' 
}) => {
  const progressPercentage = useMemo(() => {
    if (!status || !status.progress) return 0;
    
    const { current_page, total_pages, stage } = status.progress;
    
    if (!current_page || !total_pages) return 0;
    
    // Stage-based progress calculation
    const stageProgress = {
      'connecting': 5,
      'extracting': 20,
      'processing': 50,
      'analyzing': 80,
      'finalizing': 95,
      'completed': 100
    };
    
    const baseProgress = stageProgress[stage] || 0;
    const pageProgress = (current_page / total_pages) * 70; // 70% allocated for page processing
    
    return Math.min(Math.round(baseProgress + pageProgress), 100);
  }, [status]);

  const progressDescription = useMemo(() => {
    if (!status || !status.progress) return '';
    
    const { current_page, total_pages, stage, estimated_time } = status.progress;
    
    const stageDescriptions = {
      'connecting': 'Connecting to OCR service...',
      'extracting': 'Extracting text from PDF...',
      'processing': `Processing page ${current_page} of ${total_pages}...`,
      'analyzing': 'Analyzing extracted content...',
      'finalizing': 'Finalizing results...',
      'completed': 'OCR completed successfully!'
    };
    
    let description = stageDescriptions[stage] || 'Processing...';
    
    if (estimated_time && stage !== 'completed') {
      description += ` (Est. ${Math.round(estimated_time)}s remaining)`;
    }
    
    return description;
  }, [status]);

  if (!status) {
    return null;
  }

  const getStatusClass = () => {
    switch (status.status) {
      case 'connecting': return 'ocr-connecting';
      case 'processing': return 'ocr-processing';
      case 'completed': return 'ocr-completed';
      case 'error': return 'ocr-error';
      default: return '';
    }
  };

  const getStatusIcon = () => {
    switch (status.status) {
      case 'connecting': return '🔗';
      case 'processing': return '⚡';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '📄';
    }
  };

  const renderProgressBar = () => (
    <div className="ocr-progress-bar">
      <div 
        className="ocr-progress-fill" 
        style={{ width: `${progressPercentage}%` }}
      />
    </div>
  );

  const renderStatusMessage = () => {
    if (status.status === 'error') {
      return (
        <div className="ocr-error">
          {getStatusIcon()} Error: {status.error || 'OCR processing failed'}
        </div>
      );
    }
    
    return (
      <div className={getStatusClass()}>
        {getStatusIcon()} {progressDescription}
      </div>
    );
  };

  if (compact) {
    return (
      <div className={`ocr-status ${className}`}>
        {status.status === 'processing' && renderProgressBar()}
        {renderStatusMessage()}
      </div>
    );
  }

  return (
    <div className={`ocr-status-sidebar ${className}`}>
      {status.status === 'processing' && (
        <>
          {renderProgressBar()}
          <div className="progress-text">{progressPercentage}%</div>
        </>
      )}
      {renderStatusMessage()}
    </div>
  );
};

export default OCRProgressIndicator;