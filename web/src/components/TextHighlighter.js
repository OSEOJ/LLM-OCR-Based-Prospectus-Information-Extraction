import React, { useState, useCallback, useMemo } from 'react';
import './TextHighlighter.css';

const TextHighlighter = ({ 
  text, 
  fieldMappings = [], 
  selectedField = null, 
  onFieldSelect = null,
  onTextSelect = null 
}) => {
  const [hoveredMapping, setHoveredMapping] = useState(null);

  // 텍스트 매칭 기반으로 하이라이트할 구간들을 찾기
  const processedMappings = useMemo(() => {
    if (!fieldMappings || fieldMappings.length === 0 || !text) return [];
    
    console.log('텍스트 매칭 시작:', { 
      textLength: text.length, 
      mappingsCount: fieldMappings.length,
      mappings: fieldMappings.map(m => ({ 
        field: m.field, 
        sourceText: m.source_text,
        value: m.value
      }))
    });
    
    const foundMappings = [];
    
    fieldMappings.forEach((mapping, index) => {
      if (!mapping.source_text) {
        console.warn(`매핑 ${index}에 source_text가 없음:`, mapping);
        return;
      }
      
      // 원본 텍스트에서 source_text 찾기 (공백, 줄바꿈 정규화)
      const searchText = mapping.source_text.trim().replace(/\s+/g, ' ');
      const normalizedText = text.replace(/\s+/g, ' ');
      const textIndex = normalizedText.indexOf(searchText);
      
      if (textIndex >= 0) {
        // 정확한 매칭 성공
        foundMappings.push({
          ...mapping,
          matchStart: textIndex,
          matchEnd: textIndex + searchText.length,
          matchText: searchText,
          partialMatch: false
        });
        console.log(`매핑 ${index} 정확 매칭 성공:`, {
          field: mapping.field,
          searchText: searchText,
          foundAt: textIndex
        });
      } else {
        // 부분 매칭 시도
        const words = searchText.split(/\s+/);
        if (words.length > 1) {
          // 첫 단어와 마지막 단어로 범위 찾기
          const firstWord = words[0];
          const lastWord = words[words.length - 1];
          const firstIndex = text.indexOf(firstWord);
          const lastIndex = text.indexOf(lastWord, firstIndex);
          
          if (firstIndex >= 0 && lastIndex >= 0) {
            foundMappings.push({
              ...mapping,
              matchStart: firstIndex,
              matchEnd: lastIndex + lastWord.length,
              matchText: text.slice(firstIndex, lastIndex + lastWord.length),
              partialMatch: true
            });
            console.log(`매핑 ${index} 부분 매칭 성공:`, {
              field: mapping.field,
              originalText: searchText,
              matchText: text.slice(firstIndex, lastIndex + lastWord.length)
            });
          } else {
            console.warn(`매핑 ${index} 실패:`, {
              field: mapping.field,
              searchText: searchText,
              textPreview: text.slice(0, 200)
            });
          }
        } else {
          console.warn(`매핑 ${index} 실패:`, {
            field: mapping.field,
            searchText: searchText
          });
        }
      }
    });
    
    // 시작 위치로 정렬하고 겹치는 구간 해결
    foundMappings.sort((a, b) => a.matchStart - b.matchStart);
    
    const resolved = [];
    foundMappings.forEach(current => {
      const lastResolved = resolved[resolved.length - 1];
      if (!lastResolved || current.matchStart >= lastResolved.matchEnd) {
        resolved.push(current);
      } else {
        // 겹치는 경우 더 긴 구간 선택
        if (current.matchEnd - current.matchStart > lastResolved.matchEnd - lastResolved.matchStart) {
          resolved[resolved.length - 1] = current;
        }
      }
    });
    
    console.log(`텍스트 매칭 완료: ${resolved.length}개 구간 발견`);
    return resolved;
  }, [fieldMappings, text]);

  // 텍스트를 하이라이트된 부분과 일반 부분으로 분할 (최소한의 span 사용)
  const renderHighlightedText = useCallback(() => {
    if (!text || processedMappings.length === 0) {
      console.log('텍스트 하이라이트 조건:', { text: !!text, mappingsCount: processedMappings.length });
      return text;
    }

    console.log('최소한의 span으로 색상 적용');

    const parts = [];
    let lastIndex = 0;

    processedMappings.forEach((mapping, index) => {
      const { matchStart, matchEnd } = mapping;
      
      // 하이라이트 이전 텍스트 추가
      if (lastIndex < matchStart) {
        parts.push(text.slice(lastIndex, matchStart));
      }

      // 모든 매칭을 하나의 색상으로 표시
      parts.push(
        <span key={index} style={{ color: '#007bff' }}>
          {text.slice(matchStart, matchEnd)}
        </span>
      );

      lastIndex = matchEnd;
    });

    // 마지막 부분 텍스트 추가
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  }, [text, processedMappings]);

  // 텍스트 선택 핸들러
  const handleTextSelection = useCallback(() => {
    if (!onTextSelect) return;
    
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString();
      const start = range.startOffset;
      const end = range.endOffset;
      
      onTextSelect({
        text: selectedText,
        start,
        end,
        range
      });
    }
  }, [onTextSelect]);

  if (!text) {
    return (
      <div className="text-highlighter-container">
        <div className="empty-text-message">
          텍스트가 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="text-highlighter-content">
      <pre className="highlighted-text">
        {renderHighlightedText()}
      </pre>
    </div>
  );
};

export default TextHighlighter;