import React, { useState, useRef, useEffect } from 'react';
import '../../styles/design-system.css';

/**
 * ProductTypeSelector Component
 * Figma 디자인 기반 상품 선택 탭 컴포넌트
 * 
 * Features:
 * - 3가지 상품 타입 (Bond Forward, FRN, IRS)
 * - 활성화 상태 표시
 * - 드롭다운 아이콘
 * - 호버 효과
 */
const ProductTypeSelector = ({
  selectedProductType = 'bond_forward',
  onProductTypeChange,
  disabled = false
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const productTypes = [
    {
      id: 'bond_forward',
      label: 'Bond Forward',
      description: '채권선도'
    },
    {
      id: 'frn',
      label: 'FRN',
      description: '변동금리채권'
    },
    {
      id: 'irs',
      label: 'IRS',
      description: '금리스왑'
    }
    // CRS(통화스왑)는 prompts.yaml 에 템플릿이 없어 선택 시 실패한다.
    // prompts/prompts.yaml 에 crs 항목을 추가한 뒤 여기에 되살릴 것.
  ];

  const handleProductTypeClick = (productType) => {
    if (!disabled && onProductTypeChange) {
      onProductTypeChange(productType.id);
      setIsDropdownOpen(false); // 선택 후 드롭다운 닫기
    }
  };

  const toggleDropdown = () => {
    if (!disabled) {
      setIsDropdownOpen(!isDropdownOpen);
    }
  };

  // 외부 클릭시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedProduct = productTypes.find(p => p.id === selectedProductType);

  return (
    <div className="product-type-selector" ref={dropdownRef}>
      {/* 메인 선택 버튼 */}
      <div className="product-dropdown-container">
        <div
          className={`product-main-tab ${disabled ? 'disabled' : ''}`}
          onClick={toggleDropdown}
        >
          <div className="product-tab-content">
            <span className="product-label">{selectedProduct?.label}</span>
            <div className={`dropdown-icon ${isDropdownOpen ? 'open' : ''}`}>
              <svg width="7" height="4" viewBox="0 0 7 4" fill="none">
                <path 
                  d="M1 1L3.5 3L6 1" 
                  stroke="currentColor" 
                  strokeWidth="1" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* 추가 버튼 - Bond Forward일 때만 표시 */}
          {selectedProductType === 'bond_forward' && (
            <div className="add-button">
              <div className="btn-round btn-primary">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path 
                    d="M6.5 1V12M1 6.5H12" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* 드롭다운 메뉴 */}
        {isDropdownOpen && (
          <div className="product-dropdown-menu">
            {productTypes.map((productType) => (
              <div
                key={productType.id}
                className={`product-dropdown-item ${selectedProductType === productType.id ? 'selected' : ''}`}
                onClick={() => handleProductTypeClick(productType)}
              >
                <span className="product-label">{productType.label}</span>
                <span className="product-description">{productType.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 선택된 상품 정보 */}
      <div className="selected-product-info">
        <div className="product-info-card">
          {selectedProductType && (
            <div className="product-details">
              <h3 className="product-name">
                {productTypes.find(p => p.id === selectedProductType)?.label}
              </h3>
              <p className="product-description">
                {productTypes.find(p => p.id === selectedProductType)?.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductTypeSelector;