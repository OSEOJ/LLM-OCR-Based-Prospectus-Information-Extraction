import React, { useState, useCallback, useMemo } from 'react';
import './JSONFieldMapper.css';

const JSONFieldMapper = ({ 
  jsonData, 
  fieldMappings = [], 
  originalText = "",
  selectedField = null, 
  onFieldSelect = null,
  onFieldUpdate = null,
  onValidationChange = null,
  editable = true
}) => {
  const [editingField, setEditingField] = useState(null);
  const [validationStates, setValidationStates] = useState({});

  // JSON 데이터를 플랫 구조로 변환
  const flattenedFields = useMemo(() => {
    const flatten = (obj, prefix = '') => {
      const fields = [];
      
      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          fields.push(...flatten(value, fieldPath));
        } else {
          fields.push({
            path: fieldPath,
            key,
            value: value,
            type: Array.isArray(value) ? 'array' : typeof value
          });
        }
      }
      
      return fields;
    };
    
    if (!jsonData) return [];
    return flatten(jsonData);
  }, [jsonData]);

  // 필드별 매핑 정보 찾기
  const getFieldMapping = useCallback((fieldPath) => {
    return fieldMappings.find(mapping => 
      mapping.field === fieldPath || 
      mapping.field === fieldPath.split('.').pop()
    );
  }, [fieldMappings]);

  // 필드 검증 상태 업데이트
  const updateValidationState = useCallback((fieldPath, isValid, comment = '') => {
    setValidationStates(prev => {
      const newStates = {
        ...prev,
        [fieldPath]: { isValid, comment, timestamp: Date.now() }
      };
      
      if (onValidationChange) {
        onValidationChange(newStates);
      }
      
      return newStates;
    });
  }, [onValidationChange]);

  // 필드 값 수정
  const handleFieldEdit = useCallback((fieldPath, newValue) => {
    if (onFieldUpdate) {
      onFieldUpdate(fieldPath, newValue);
    }
    setEditingField(null);
  }, [onFieldUpdate]);

  // JSON 값을 표시용으로 포맷
  const formatValue = useCallback((value) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (Array.isArray(value)) return `[${value.length} items]`;
    return String(value);
  }, []);

  // 신뢰도에 따른 색상 결정
  const getConfidenceColor = useCallback((confidence) => {
    if (confidence >= 0.8) return '#28a745'; // 높음 - 녹색
    if (confidence >= 0.6) return '#ffc107'; // 보통 - 노란색
    return '#dc3545'; // 낮음 - 빨간색
  }, []);

  if (!jsonData) {
    return (
      <div className="json-field-mapper-container">
        <div className="empty-json-message">
          JSON 데이터가 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="json-field-mapper-container">
      <div className="json-field-mapper-header">
        <h3>JSON 필드 매핑</h3>
        <div className="validation-summary">
          {Object.keys(validationStates).length > 0 && (
            <>
              <span className="validation-count">
                검수 완료: {Object.values(validationStates).filter(v => v.isValid !== undefined).length}
              </span>
              <span className="validation-valid">
                ✓ {Object.values(validationStates).filter(v => v.isValid === true).length}
              </span>
              <span className="validation-invalid">
                ✗ {Object.values(validationStates).filter(v => v.isValid === false).length}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="json-fields-list">
        {flattenedFields.map((field, index) => {
          const mapping = getFieldMapping(field.path);
          const validation = validationStates[field.path];
          const isSelected = selectedField === field.path || selectedField === field.key;
          const isEditing = editingField === field.path;

          return (
            <div 
              key={index}
              className={`json-field-item ${isSelected ? 'selected' : ''} ${mapping ? 'has-mapping' : ''}`}
              onClick={() => onFieldSelect && onFieldSelect(field.key)}
            >
              <div className="field-header">
                <div className="field-name">
                  <span className="field-path">{field.path}</span>
                  <span className="field-type">({field.type})</span>
                </div>
                
                {mapping && (
                  <div className="field-confidence">
                    <span 
                      className="confidence-badge"
                      style={{ backgroundColor: getConfidenceColor(mapping.confidence || 1.0) }}
                    >
                      {((mapping.confidence || 1.0) * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>

              <div className="field-value-section">
                {isEditing && editable ? (
                  <div className="field-edit-form">
                    <input
                      type="text"
                      defaultValue={field.value}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleFieldEdit(field.path, e.target.value);
                        } else if (e.key === 'Escape') {
                          setEditingField(null);
                        }
                      }}
                      onBlur={(e) => handleFieldEdit(field.path, e.target.value)}
                      autoFocus
                      className="field-edit-input"
                    />
                    <div className="field-edit-actions">
                      <button 
                        className="btn-save"
                        onClick={(e) => {
                          e.stopPropagation();
                          const input = e.target.closest('.field-edit-form').querySelector('input');
                          handleFieldEdit(field.path, input.value);
                        }}
                      >
                        저장
                      </button>
                      <button 
                        className="btn-cancel"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingField(null);
                        }}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="field-value">
                    <span className="value-text">{formatValue(field.value)}</span>
                    {editable && (
                      <button 
                        className="btn-edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingField(field.path);
                        }}
                        title="값 수정"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                )}
              </div>

              {mapping && (
                <div className="field-mapping-info">
                  <div className="mapping-source">
                    <strong>원본:</strong> "{mapping.source_text || '찾을 수 없음'}"
                  </div>
                  {mapping.confidence && (
                    <div className="mapping-confidence">
                      신뢰도: {(mapping.confidence * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              )}

              <div className="field-validation">
                <div className="validation-buttons">
                  <button 
                    className={`validation-btn valid ${validation?.isValid === true ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateValidationState(field.path, true);
                    }}
                    title="올바른 추출"
                  >
                    ✓ 올바름
                  </button>
                  <button 
                    className={`validation-btn invalid ${validation?.isValid === false ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateValidationState(field.path, false);
                    }}
                    title="잘못된 추출"
                  >
                    ✗ 오류
                  </button>
                  <button 
                    className="validation-btn comment"
                    onClick={(e) => {
                      e.stopPropagation();
                      const comment = prompt('검수 코멘트를 입력하세요:', validation?.comment || '');
                      if (comment !== null) {
                        updateValidationState(field.path, validation?.isValid, comment);
                      }
                    }}
                    title="코멘트 추가"
                  >
                    💬
                  </button>
                </div>
                
                {validation?.comment && (
                  <div className="validation-comment">
                    <strong>코멘트:</strong> {validation.comment}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mapping-statistics">
        <h4>매핑 통계</h4>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">{flattenedFields.length}</div>
            <div className="stat-label">전체 필드</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{fieldMappings.length}</div>
            <div className="stat-label">매핑된 필드</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              {fieldMappings.length > 0 
                ? ((fieldMappings.reduce((acc, m) => acc + (m.confidence || 1.0), 0) / fieldMappings.length) * 100).toFixed(1)
                : 0}%
            </div>
            <div className="stat-label">평균 신뢰도</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              {Object.values(validationStates).filter(v => v.isValid === true).length}
            </div>
            <div className="stat-label">검수 완료</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JSONFieldMapper;