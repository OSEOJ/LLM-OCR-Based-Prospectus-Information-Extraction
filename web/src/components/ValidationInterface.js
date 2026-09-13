import React, { useState, useCallback, useEffect } from 'react';
import TextHighlighter from './TextHighlighter';
import JSONFieldMapper from './JSONFieldMapper';
import './ValidationInterface.css';

const ValidationInterface = ({ 
  originalText, 
  jsonResult, 
  fieldMappings = [],
  onValidationComplete = null,
  onFieldUpdate = null,
  debugMode = false
}) => {
  const [selectedField, setSelectedField] = useState(null);
  const [validationStates, setValidationStates] = useState({});
  const [viewMode, setViewMode] = useState('split'); // 'split', 'text', 'json'

  // 필드 선택 핸들러
  const handleFieldSelect = useCallback((fieldName) => {
    setSelectedField(fieldName);
  }, []);

  // 텍스트 선택 핸들러 (텍스트 매칭 기반)
  const handleTextSelect = useCallback((textSelection) => {
    // 선택된 텍스트와 관련된 필드 찾기 (source_text 기반)
    const relatedMapping = fieldMappings.find(mapping => {
      if (!mapping.source_text) return false;
      const selectedText = textSelection.text.trim();
      const sourceText = mapping.source_text.trim();
      
      // 선택된 텍스트가 source_text에 포함되거나 그 반대인 경우
      return selectedText.includes(sourceText) || sourceText.includes(selectedText);
    });

    if (relatedMapping) {
      setSelectedField(relatedMapping.field);
    }
  }, [fieldMappings]);

  // 검수 상태 변경 핸들러
  const handleValidationChange = useCallback((newValidationStates) => {
    setValidationStates(newValidationStates);
    
    if (onValidationComplete) {
      const totalFields = Object.keys(jsonResult || {}).length;
      const validatedFields = Object.keys(newValidationStates).length;
      const validFields = Object.values(newValidationStates).filter(v => v.isValid === true).length;
      
      onValidationComplete({
        totalFields,
        validatedFields,
        validFields,
        states: newValidationStates
      });
    }
  }, [jsonResult, onValidationComplete]);

  // 필드 수정 핸들러
  const handleFieldUpdate = useCallback((fieldPath, newValue) => {
    if (onFieldUpdate) {
      onFieldUpdate(fieldPath, newValue);
    }
  }, [onFieldUpdate]);

  // 검수 완료율 계산
  const getValidationProgress = useCallback(() => {
    if (!jsonResult) return { total: 0, validated: 0, valid: 0, percentage: 0 };
    
    const flattenObject = (obj, prefix = '') => {
      const fields = [];
      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          fields.push(...flattenObject(value, fieldPath));
        } else {
          fields.push(fieldPath);
        }
      }
      return fields;
    };

    const totalFields = flattenObject(jsonResult);
    const validatedFields = Object.keys(validationStates).length;
    const validFields = Object.values(validationStates).filter(v => v.isValid === true).length;
    
    return {
      total: totalFields.length,
      validated: validatedFields,
      valid: validFields,
      percentage: totalFields.length > 0 ? (validatedFields / totalFields.length) * 100 : 0
    };
  }, [jsonResult, validationStates]);

  const progress = getValidationProgress();

  if (!originalText || !jsonResult) {
    return (
      <div className="validation-interface-container">
        <div className="empty-state">
          <h3>검수할 데이터가 없습니다</h3>
          <p>파일을 업로드하고 변환을 완료한 후 검수를 진행해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="validation-interface-container">
      {/* 검수 헤더 */}
      <div className="validation-header">
        <div className="validation-title">
          <h2>🔍 텍스트-JSON 검수 인터페이스</h2>
          <div className="progress-info">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress.percentage}%` }}
              ></div>
            </div>
            <span className="progress-text">
              검수 진행률: {progress.validated}/{progress.total} ({progress.percentage.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* 보기 모드 전환 */}
        <div className="view-mode-selector">
          <button 
            className={`mode-btn ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => setViewMode('split')}
          >
            📱 분할
          </button>
          <button 
            className={`mode-btn ${viewMode === 'text' ? 'active' : ''}`}
            onClick={() => setViewMode('text')}
          >
            📄 텍스트
          </button>
          <button 
            className={`mode-btn ${viewMode === 'json' ? 'active' : ''}`}
            onClick={() => setViewMode('json')}
          >
            🗂️ JSON
          </button>
        </div>
      </div>

      {/* 선택된 필드 정보 */}
      {selectedField && (
        <div className="selected-field-info">
          <h4>선택된 필드: <span className="field-name">{selectedField}</span></h4>
          {fieldMappings.find(m => m.field === selectedField) && (
            <div className="field-details">
              <span className="field-value">
                값: {fieldMappings.find(m => m.field === selectedField)?.value}
              </span>
              <span className="field-confidence">
                신뢰도: {((fieldMappings.find(m => m.field === selectedField)?.confidence || 1.0) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* 디버깅 정보 (개발 모드에서만) */}
      {debugMode && (
        <div className="debug-info">
          <h4>🔧 디버깅 정보</h4>
          <div className="debug-details">
            <div><strong>원본 텍스트 길이:</strong> {originalText?.length || 0}</div>
            <div><strong>매핑 개수:</strong> {fieldMappings.length}</div>
            <div><strong>JSON 필드 개수:</strong> {Object.keys(jsonResult || {}).length}</div>
            {fieldMappings.length > 0 && (
              <details>
                <summary>매핑 상세 정보</summary>
                <pre className="debug-code">
                  {JSON.stringify(fieldMappings, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className={`validation-content ${viewMode}`}>
        {/* 텍스트 하이라이터 */}
        {(viewMode === 'split' || viewMode === 'text') && (
          <div className="text-panel">
            <TextHighlighter
              text={originalText}
              fieldMappings={fieldMappings}
              selectedField={selectedField}
              onFieldSelect={handleFieldSelect}
              onTextSelect={handleTextSelect}
            />
          </div>
        )}

        {/* JSON 필드 매퍼 */}
        {(viewMode === 'split' || viewMode === 'json') && (
          <div className="json-panel">
            <JSONFieldMapper
              jsonData={jsonResult}
              fieldMappings={fieldMappings}
              originalText={originalText}
              selectedField={selectedField}
              onFieldSelect={handleFieldSelect}
              onFieldUpdate={handleFieldUpdate}
              onValidationChange={handleValidationChange}
              editable={true}
            />
          </div>
        )}
      </div>

      {/* 검수 요약 */}
      <div className="validation-summary">
        <div className="summary-stats">
          <div className="stat-card">
            <div className="stat-number">{progress.total}</div>
            <div className="stat-label">전체 필드</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{fieldMappings.length}</div>
            <div className="stat-label">매핑된 필드</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{progress.valid}</div>
            <div className="stat-label">검수 통과</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {fieldMappings.length > 0 
                ? ((fieldMappings.reduce((acc, m) => acc + (m.confidence || 1.0), 0) / fieldMappings.length) * 100).toFixed(0)
                : 0}%
            </div>
            <div className="stat-label">평균 신뢰도</div>
          </div>
        </div>

        {/* 검수 완료 버튼 */}
        {progress.percentage >= 80 && (
          <div className="validation-actions">
            <button 
              className="complete-btn"
              onClick={() => {
                if (onValidationComplete) {
                  onValidationComplete({
                    ...progress,
                    states: validationStates,
                    completed: true
                  });
                }
              }}
            >
              ✅ 검수 완료
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ValidationInterface;