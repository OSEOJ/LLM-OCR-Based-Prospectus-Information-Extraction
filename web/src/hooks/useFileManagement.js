import { useState, useCallback } from 'react';
import { 
  createFileData, 
  removeFileById, 
  findFileById, 
  updateFileStatus,
  getFilesByStatus,
  sortFiles,
  validateFile
} from '../utils/fileUtils';

/**
 * Custom hook for managing file operations
 * Handles file upload, validation, selection, and status management
 */
const useFileManagement = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Add new files with validation
  const addFiles = useCallback((newFiles) => {
    const processedFiles = [];
    const errors = [];

    Array.from(newFiles).forEach(file => {
      const validation = validateFile(file);
      
      if (validation.isValid) {
        const fileData = createFileData(file);
        processedFiles.push(fileData);
      } else {
        errors.push({
          fileName: file.name,
          errors: validation.errors
        });
      }
    });

    if (processedFiles.length > 0) {
      setFiles(prev => [...prev, ...processedFiles]);
    }

    return {
      addedFiles: processedFiles,
      errors,
      addedCount: processedFiles.length,
      errorCount: errors.length
    };
  }, []);

  // Remove file by ID
  const removeFile = useCallback((fileId) => {
    setFiles(prev => {
      const newFiles = removeFileById(prev, fileId);
      
      // Clear selection if selected file was removed
      if (selectedFile && selectedFile.id === fileId) {
        setSelectedFile(null);
      }
      
      return newFiles;
    });
  }, [selectedFile]);

  // Select file for viewing/processing
  const selectFile = useCallback((fileId) => {
    const file = files.find(f => f.id === fileId);
    setSelectedFile(file || null);
  }, [files]);

  // Update file status with additional data
  const updateFile = useCallback((fileId, status, additionalData = {}) => {
    setFiles(prev => updateFileStatus(prev, fileId, status, additionalData));
    
    // Update selected file if it matches
    if (selectedFile && selectedFile.id === fileId) {
      setSelectedFile(prev => ({ ...prev, status, ...additionalData }));
    }
  }, [selectedFile]);

  // Clear all files
  const clearAllFiles = useCallback(() => {
    setFiles([]);
    setSelectedFile(null);
  }, []);

  // Get file by ID
  const getFile = useCallback((fileId) => {
    return findFileById(files, fileId);
  }, [files]);

  // Get files by status
  const getFilesByStatusType = useCallback((status) => {
    return getFilesByStatus(files, status);
  }, [files]);

  // Sort files
  const sortFilesBy = useCallback((criteria) => {
    setFiles(prev => sortFiles(prev, criteria));
  }, []);

  // Handle drag and drop events
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      return addFiles(droppedFiles);
    }
    
    return { addedFiles: [], errors: [], addedCount: 0, errorCount: 0 };
  }, [addFiles]);

  // Handle file input change
  const handleFileInputChange = useCallback((e) => {
    const selectedFiles = e.target.files;
    if (selectedFiles.length > 0) {
      const result = addFiles(selectedFiles);
      e.target.value = ''; // Clear input
      return result;
    }
    
    return { addedFiles: [], errors: [], addedCount: 0, errorCount: 0 };
  }, [addFiles]);

  // Get file statistics
  const getFileStats = useCallback(() => {
    const totalFiles = files.length;
    const uploadedFiles = getFilesByStatus(files, 'uploaded').length;
    const processingFiles = getFilesByStatus(files, 'processing').length;
    const completedFiles = getFilesByStatus(files, 'completed').length;
    const errorFiles = getFilesByStatus(files, 'error').length;
    
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    return {
      totalFiles,
      uploadedFiles,
      processingFiles,
      completedFiles,
      errorFiles,
      totalSize
    };
  }, [files]);

  return {
    // State
    files,
    selectedFile,
    dragOver,
    
    // File operations
    addFiles,
    removeFile,
    selectFile,
    updateFile,
    clearAllFiles,
    getFile,
    getFilesByStatus: getFilesByStatusType,
    sortFilesBy,
    
    // Drag and drop handlers
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange,
    
    // Computed values
    fileCount: files.length,
    hasFiles: files.length > 0,
    hasSelectedFile: selectedFile !== null,
    getFileStats
  };
};

export default useFileManagement;