import { useState, useCallback } from 'react';

export const useFileUpload = (onFileSelected) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const validateFile = useCallback((file) => {
    const maxSizeInBytes = 50 * 1024 * 1024; // 50MB
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    if (!allowedTypes.includes(file.type)) {
      throw new Error('PDF 또는 DOCX 파일만 업로드 가능합니다.');
    }
    
    if (file.size > maxSizeInBytes) {
      throw new Error('파일 크기는 50MB 이하여야 합니다.');
    }
    
    return true;
  }, []);

  const handleFileSelect = useCallback(async (files) => {
    try {
      setUploadError(null);
      
      if (!files || files.length === 0) {
        return;
      }

      const file = files[0];
      validateFile(file);
      
      if (onFileSelected) {
        await onFileSelected(file);
      }
    } catch (error) {
      console.error('파일 선택 오류:', error);
      setUploadError(error.message);
    }
  }, [validateFile, onFileSelected]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    await handleFileSelect(files);
  }, [handleFileSelect]);

  const handleInputChange = useCallback(async (e) => {
    const files = Array.from(e.target.files);
    await handleFileSelect(files);
  }, [handleFileSelect]);

  const clearError = useCallback(() => {
    setUploadError(null);
  }, []);

  return {
    isDragOver,
    uploadError,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleInputChange,
    clearError
  };
};