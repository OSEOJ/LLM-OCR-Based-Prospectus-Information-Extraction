import React from 'react';

/**
 * ProductTypeSelector Component
 * Allows users to select product type for conversion
 */
const ProductTypeSelector = ({ 
  selectedProductType, 
  onProductTypeChange, 
  disabled = false,
  className = '' 
}) => {
  const productTypes = [
    { value: '채권선도', label: '채권선도 (Bond Forward)', description: 'Fixed-income derivative instrument' },
    { value: 'FRN', label: 'FRN (Floating Rate Note)', description: 'Variable interest rate security' }
  ];

  return (
    <div className={`product-selector ${className}`}>
      <label htmlFor="product-type-select">
        📊 Select Product Type
      </label>
      
      <select
        id="product-type-select"
        value={selectedProductType}
        onChange={(e) => onProductTypeChange(e.target.value)}
        disabled={disabled}
      >
        {productTypes.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
      
      <div className="product-description">
        {productTypes.find(type => type.value === selectedProductType)?.description}
      </div>
      
      <div className="selection-info">
        <small>
          💡 The selected product type determines the JSON schema and field mappings 
          used during conversion.
        </small>
      </div>
    </div>
  );
};

/**
 * Inline Product Type Selector (compact version)
 */
export const InlineProductTypeSelector = ({ 
  selectedProductType, 
  onProductTypeChange, 
  disabled = false,
  className = '' 
}) => {
  return (
    <div className={`inline-product-selector ${className}`}>
      <span className="selector-label">Product Type:</span>
      <select
        value={selectedProductType}
        onChange={(e) => onProductTypeChange(e.target.value)}
        disabled={disabled}
        className="compact-select"
      >
        <option value="채권선도">채권선도</option>
        <option value="FRN">FRN</option>
      </select>
    </div>
  );
};

export default ProductTypeSelector;