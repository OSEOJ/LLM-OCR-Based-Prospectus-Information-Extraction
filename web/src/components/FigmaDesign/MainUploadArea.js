import React from 'react';
import ProductTypeSelector from './ProductTypeSelector';
import '../../styles/design-system.css';

/**
 * MainUploadArea Component
 * Figma 디자인 기반 메인 업로드 영역 컴포넌트
 * 
 * Features:
 * - 중앙 정렬된 메인 제목
 * - 드래그 앤 드롭 업로드 영역
 * - 상품 선택 탭
 * - 파일 선택 버튼
 */
const MainUploadArea = ({
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileInputChange,
  selectedProductType,
  onProductTypeChange,
  disabled = false,
  hasFiles = false
}) => {
  const fileInputRef = React.useRef(null);

  const handleUploadClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    if (onFileInputChange) {
      onFileInputChange(e);
    }
  };

  return (
    <div className="main-upload-container">
      {/* 메인 헤더 */}
      <header className="main-header">
        <div className="logo-container">
          <span className="company-logo">termsheet2json</span>
        </div>
        <h1 className="main-title">
          LLM 기반 투자설명서 자동 변환 시스템
        </h1>
      </header>

      {/* 업로드 영역 */}
      <div className="upload-section">
        <div 
          className={`card-upload ${dragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={handleUploadClick}
        >
          <div className="upload-content">
            <div className="upload-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path 
                  d="M12 15V3M12 3L8 7M12 3L16 7" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="upload-text">
              파일을 업로드해주세요. (PDF 또는 DOCX 파일)
            </p>
            <p className="upload-subtext">
              {dragOver ? '파일을 여기에 놓으세요' : '드래그하여 놓거나 클릭하여 선택'}
            </p>
          </div>
        </div>

        {/* 숨겨진 파일 입력 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
          disabled={disabled}
        />
      </div>

      {/* 상품 선택 탭 */}
      <ProductTypeSelector
        selectedProductType={selectedProductType}
        onProductTypeChange={onProductTypeChange}
        disabled={disabled}
      />

      {/* Backend status removed per user request */}
    </div>
  );
};

export default MainUploadArea;