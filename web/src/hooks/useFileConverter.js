import { useState, useCallback } from 'react';
import { convertFile } from '../utils/apiUtils';

/**
 * Custom hook for file conversion operations
 * Handles PDF to JSON conversion with progress tracking
 */
const useFileConverter = (showNotification) => {
  // Conversion state
  const [selectedProductType, setSelectedProductType] = useState('채권선도');
  const [convertedFiles, setConvertedFiles] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [fieldMappings, setFieldMappings] = useState([]);

  // Progress update function
  const updateProgress = useCallback((step, percent) => {
    setProcessingStep(step);
    setProgress(percent);
  }, []);

  // Convert PDF to JSON (basic - no mapping)
  const convertPdfToJson = useCallback(async (fileData, productType) => {
    setIsProcessing(true);
    updateProgress('Uploading file...', 10);

    try {
      const formData = new FormData();
      formData.append('file', fileData.file);
      formData.append('product_type', productType === '채권선도' ? 'bond_forward' : 'FRN');

      updateProgress('Sending file to server...', 20);
      
      console.log('Starting API call for conversion');
      const response = await convertFile(formData);

      console.log('Response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Error occurred during conversion.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        }
        throw new Error(`Conversion failed: ${errorMessage}`);
      }

      updateProgress('Processing response...', 80);
      const data = await response.json();

      updateProgress('Finalizing...', 95);

      // Create conversion result
      const conversionResult = {
        id: Date.now().toString(),
        originalFile: fileData,
        productType,
        convertedData: data,
        timestamp: new Date().toISOString(),
        status: 'completed'
      };

      setConvertedFiles(prev => [...prev, conversionResult]);
      setSelectedResult(conversionResult);

      updateProgress('Completed!', 100);
      
      if (showNotification) {
        showNotification('File converted successfully!', 'success');
      }

      return conversionResult;

    } catch (error) {
      console.error('Conversion error:', error);
      const errorMessage = error.message || 'Unknown error occurred during conversion.';
      
      if (showNotification) {
        showNotification(errorMessage, 'error');
      }
      
      updateProgress('Error occurred', 0);
      throw error;
    } finally {
      setIsProcessing(false);
      // Clear progress after delay
      setTimeout(() => {
        setProgress(0);
        setProcessingStep('');
      }, 3000);
    }
  }, [updateProgress, showNotification]);

  // Convert with field mapping
  const convertWithMapping = useCallback(async (fileData, productType, mappings) => {
    setIsProcessing(true);
    updateProgress('Preparing mapping conversion...', 10);

    try {
      const formData = new FormData();
      formData.append('file', fileData.file);
      formData.append('product_type', productType === '채권선도' ? 'bond_forward' : 'FRN');
      formData.append('field_mappings', JSON.stringify(mappings));
      formData.append('use_mapping', 'true');

      updateProgress('Processing with field mappings...', 30);
      
      const response = await convertFile(formData);

      if (!response.ok) {
        let errorMessage = 'Error occurred during mapping conversion.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          if (errorText) errorMessage = errorText;
        }
        throw new Error(`Mapping conversion failed: ${errorMessage}`);
      }

      updateProgress('Processing mapped response...', 80);
      const data = await response.json();

      const conversionResult = {
        id: Date.now().toString(),
        originalFile: fileData,
        productType,
        convertedData: data,
        fieldMappings: mappings,
        timestamp: new Date().toISOString(),
        status: 'completed',
        type: 'mapped'
      };

      setConvertedFiles(prev => [...prev, conversionResult]);
      setSelectedResult(conversionResult);

      updateProgress('Mapping completed!', 100);
      
      if (showNotification) {
        showNotification('File converted with mappings successfully!', 'success');
      }

      return conversionResult;

    } catch (error) {
      console.error('Mapping conversion error:', error);
      const errorMessage = error.message || 'Unknown error occurred during mapping conversion.';
      
      if (showNotification) {
        showNotification(errorMessage, 'error');
      }
      
      updateProgress('Error occurred', 0);
      throw error;
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setProgress(0);
        setProcessingStep('');
      }, 3000);
    }
  }, [updateProgress, showNotification]);

  // Select conversion result
  const selectResult = useCallback((resultId) => {
    const result = convertedFiles.find(r => r.id === resultId);
    setSelectedResult(result || null);
  }, [convertedFiles]);

  // Remove conversion result
  const removeResult = useCallback((resultId) => {
    setConvertedFiles(prev => prev.filter(r => r.id !== resultId));
    
    if (selectedResult && selectedResult.id === resultId) {
      setSelectedResult(null);
    }
  }, [selectedResult]);

  // Clear all results
  const clearAllResults = useCallback(() => {
    setConvertedFiles([]);
    setSelectedResult(null);
  }, []);

  // Update field mappings
  const updateFieldMappings = useCallback((mappings) => {
    setFieldMappings(mappings);
  }, []);

  return {
    // State
    selectedProductType,
    convertedFiles,
    selectedResult,
    isProcessing,
    processingStep,
    progress,
    fieldMappings,

    // Actions
    setSelectedProductType,
    convertPdfToJson,
    convertWithMapping,
    selectResult,
    removeResult,
    clearAllResults,
    updateFieldMappings,

    // Computed values
    hasResults: convertedFiles.length > 0,
    hasSelectedResult: selectedResult !== null,
    canConvert: !isProcessing,
    resultCount: convertedFiles.length
  };
};

export default useFileConverter;