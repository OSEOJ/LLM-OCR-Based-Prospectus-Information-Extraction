/**
 * File utility functions for file validation, processing, and management
 */

// Supported file types
export const SUPPORTED_FILE_TYPES = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  DOC: 'application/msword'
};

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  MAX_SIZE: 50 * 1024 * 1024, // 50MB
  WARNING_SIZE: 10 * 1024 * 1024 // 10MB (show warning)
};

// Validate file type
export const isValidFileType = (file) => {
  return Object.values(SUPPORTED_FILE_TYPES).includes(file.type);
};

// Validate file size
export const isValidFileSize = (file) => {
  return file.size <= FILE_SIZE_LIMITS.MAX_SIZE;
};

// Check if file size should trigger warning
export const isLargeFile = (file) => {
  return file.size > FILE_SIZE_LIMITS.WARNING_SIZE;
};

// Format file size for display
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Generate unique file ID
export const generateFileId = (file) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const fileName = file.name.replace(/[^a-zA-Z0-9]/g, '');
  return `${fileName}_${timestamp}_${random}`;
};

// Get file extension from filename
export const getFileExtension = (filename) => {
  return filename.split('.').pop().toLowerCase();
};

// Get file type display name
export const getFileTypeDisplay = (file) => {
  const extension = getFileExtension(file.name);
  switch (extension) {
    case 'pdf':
      return 'PDF Document';
    case 'docx':
      return 'Word Document (DOCX)';
    case 'doc':
      return 'Word Document (DOC)';
    default:
      return 'Unknown';
  }
};

// Validate and prepare file for upload
export const validateFile = (file) => {
  const errors = [];
  
  if (!isValidFileType(file)) {
    errors.push(`Unsupported file type: ${file.type}. Only PDF, DOC, and DOCX files are supported.`);
  }
  
  if (!isValidFileSize(file)) {
    errors.push(`File too large: ${formatFileSize(file.size)}. Maximum size is ${formatFileSize(FILE_SIZE_LIMITS.MAX_SIZE)}.`);
  }
  
  const warnings = [];
  if (isLargeFile(file)) {
    warnings.push(`Large file detected: ${formatFileSize(file.size)}. Processing may take longer.`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fileInfo: {
      name: file.name,
      size: formatFileSize(file.size),
      type: getFileTypeDisplay(file),
      extension: getFileExtension(file.name)
    }
  };
};

// Create file data object with metadata
export const createFileData = (file) => {
  const id = generateFileId(file);
  const validation = validateFile(file);
  
  return {
    id,
    file,
    name: file.name,
    size: file.size,
    formattedSize: formatFileSize(file.size),
    type: file.type,
    displayType: getFileTypeDisplay(file),
    extension: getFileExtension(file.name),
    uploadedAt: new Date().toISOString(),
    validation,
    status: 'uploaded' // uploaded, processing, completed, error
  };
};

// Filter files by type
export const filterFilesByType = (files, fileType) => {
  return files.filter(fileData => fileData.type === fileType);
};

// Sort files by various criteria
export const sortFiles = (files, criteria = 'name') => {
  return [...files].sort((a, b) => {
    switch (criteria) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'size':
        return b.size - a.size; // Largest first
      case 'uploadedAt':
        return new Date(b.uploadedAt) - new Date(a.uploadedAt); // Newest first
      case 'type':
        return a.displayType.localeCompare(b.displayType);
      default:
        return 0;
    }
  });
};

// Remove file from list by ID
export const removeFileById = (files, fileId) => {
  return files.filter(fileData => fileData.id !== fileId);
};

// Find file by ID
export const findFileById = (files, fileId) => {
  return files.find(fileData => fileData.id === fileId);
};

// Update file status
export const updateFileStatus = (files, fileId, status, additionalData = {}) => {
  return files.map(fileData => 
    fileData.id === fileId 
      ? { ...fileData, status, ...additionalData }
      : fileData
  );
};

// Get files by status
export const getFilesByStatus = (files, status) => {
  return files.filter(fileData => fileData.status === status);
};
// File -> base64 문자열 (data: 접두사 제외). WebSocket OCR 요청 페이로드용.
export const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});
