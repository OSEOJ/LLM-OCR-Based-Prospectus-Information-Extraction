import React from 'react';
import '../../styles/design-system.css';

/**
 * SelectedFileInfo Component
 * 선택된 파일 정보 및 변환 컨트롤 컴포넌트
 * 
 * Features:
 * - 선택된 파일 정보 표시
 * - 상품 타입 선택
 * - 변환 버튼
 */
const SelectedFileInfo = ({
  selectedFile,
  selectedProductType,
  onProductTypeChange,
  onConvert,
  isProcessing = false
}) => {
  const productTypes = [
    { id: 'bond_forward', label: 'Bond Forward', description: '채권선도' },
    { id: 'frn', label: 'FRN', description: '변동금리채권' },
    { id: 'irs', label: 'IRS', description: '금리스왑' },
    { id: 'crs', label: 'CRS', description: '통화스왑' }
  ];

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const truncateFileName = (name, maxLength = 35) => {
    if (name.length <= maxLength) return name;
    const extension = name.split('.').pop();
    const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
    const truncated = nameWithoutExt.substring(0, maxLength - extension.length - 4);
    return `${truncated}...${extension}`;
  };

  if (!selectedFile) {
    return (
      <div className="selected-file-empty">
        <div className="empty-state">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="empty-icon">
            <path 
              d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" 
              stroke="currentColor" 
              strokeWidth="1.5"
            />
            <path 
              d="M10 6V10L12 12" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
          <p className="empty-text">파일을 선택해주세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="selected-file-info">
      {/* 파일 정보 */}
      <div className="file-info-card">
        <div className="file-info-header">
          <div className="file-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path 
                d="M9.33333 1.33334H4C3.26362 1.33334 2.66667 1.93029 2.66667 2.66668V13.3333C2.66667 14.0697 3.26362 14.6667 4 14.6667H12C12.7364 14.6667 13.3333 14.0697 13.3333 13.3333V5.33334L9.33333 1.33334Z" 
                stroke="currentColor" 
                strokeWidth="1.2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M9.33333 1.33334V5.33334H13.3333" 
                stroke="currentColor" 
                strokeWidth="1.2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="file-info-details">
            <h4 className="file-info-name" title={selectedFile.name}>
              {truncateFileName(selectedFile.name)}
            </h4>
            <p className="file-info-size">{formatFileSize(selectedFile.size)}</p>
          </div>
        </div>
      </div>

      {/* 상품 타입 선택 */}
      <div className="product-type-section">
        <label className="form-label">상품 타입</label>
        <div className="product-type-grid">
          {productTypes.map((productType) => (
            <button
              key={productType.id}
              className={`product-type-btn ${selectedProductType === productType.id ? 'active' : ''}`}
              onClick={() => onProductTypeChange && onProductTypeChange(productType.id)}
              disabled={isProcessing}
            >
              <span className="product-type-label">{productType.label}</span>
              <span className="product-type-desc">{productType.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 변환 버튼 */}
      <div className="convert-section">
        <button
          className="btn btn-primary btn-convert"
          onClick={onConvert}
          disabled={!selectedFile || isProcessing}
        >
          {isProcessing ? (
            <>
              <div className="loading-spinner"></div>
              변환 중...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path 
                  d="M8 1V8M8 8L5 5M8 8L11 5" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M15 8V13C15 13.5523 14.5523 14 14 14H2C1.44772 14 1 13.5523 1 13V8" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
              JSON으로 변환
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SelectedFileInfo;