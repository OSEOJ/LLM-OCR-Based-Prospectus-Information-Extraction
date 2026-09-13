import React from 'react';
import FileManager from './FileManager';
import ConversionResults from './ConversionResults';
import SelectedFileInfo from './SelectedFileInfo';
import './Sidebar.css';

/**
 * Sidebar Component
 * Figma 디자인 기반 사이드바 컴포넌트
 * 
 * Features:
 * - 파일 추가 버튼
 * - 파일 목록 관리
 * - 변환 완료 목록
 * - 선택된 파일 정보
 */
const Sidebar = ({
  files = [],
  selectedFile,
  onFileClick,
  onFileRemove,
  onFileAdd,
  convertedFiles = [],
  selectedResult,
  onSelectResult,
  onRemoveResult,
  ocrStatus = {},
  isProcessing = false,
  selectedProductType,
  onProductTypeChange,
  onConvert
}) => {
  return (
    <div className="sidebar">
      {/* 사이드바 헤더 */}
      <div className="sidebar-header">
        <div className="logo-section">
          <span className="sidebar-logo">termsheet2json</span>
        </div>
        
        {/* 파일 추가 버튼 */}
        <div className="file-add-section">
          <button 
            className="btn-file-add"
            onClick={onFileAdd}
            disabled={isProcessing}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path 
                d="M5 1V9M1 5H9" 
                stroke="currentColor" 
                strokeWidth="0.7" 
                strokeLinecap="round"
              />
            </svg>
          </button>
          <span className="file-add-label">파일 추가</span>
        </div>
      </div>

      {/* 파일 목록 섹션 */}
      <div className="sidebar-section">
        <h3 className="section-title">파일 목록</h3>
        <div className="section-content">
          <FileManager
            files={files}
            selectedFile={selectedFile}
            onFileClick={onFileClick}
            onFileRemove={onFileRemove}
            ocrStatus={ocrStatus}
          />
        </div>
      </div>

      {/* 변환 완료 목록 섹션 */}
      <div className="sidebar-section">
        <h3 className="section-title">변환 완료 목록</h3>
        <div className="section-content">
          <ConversionResults
            convertedFiles={convertedFiles}
            selectedResult={selectedResult}
            onSelectResult={onSelectResult}
            onRemoveResult={onRemoveResult}
            isProcessing={isProcessing}
          />
        </div>
      </div>

      {/* 선택된 파일 섹션*/}
      <div className="sidebar-section sidebar-section-compact">
        <h3 className="section-title">선택된 파일</h3>
        <div className="section-content">
          <SelectedFileInfo
            selectedFile={selectedFile}
            selectedProductType={selectedProductType}
            onProductTypeChange={onProductTypeChange}
            onConvert={onConvert}
            isProcessing={isProcessing}
          />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;