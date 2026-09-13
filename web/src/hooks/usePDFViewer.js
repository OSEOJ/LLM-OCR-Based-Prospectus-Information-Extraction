import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for PDF viewing functionality
 * Handles PDF-to-image conversion, page navigation, and viewer state management
 */
const usePDFViewer = (showNotification) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfPages, setPdfPages] = useState([]); // PDF page images
  const [pdfLoading, setPdfLoading] = useState(false);
  const [documentViewMode, setDocumentViewMode] = useState('image'); // 'image' or 'text'
  const pdfWorkerRef = useRef(false);

  // Initialize PDF.js worker (once)
  const initializePDFWorker = useCallback(async () => {
    if (pdfWorkerRef.current) return;
    
    try {
      const pdfjsLib = await import('pdfjs-dist');
      if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      }
      pdfWorkerRef.current = true;
    } catch (error) {
      console.error('PDF worker initialization failed:', error);
    }
  }, []);

  // Convert PDF to images (pure image conversion only)
  const convertPdfToImages = useCallback(async (file) => {
    setPdfLoading(true);
    
    try {
      await initializePDFWorker();
      const pdfjsLib = await import('pdfjs-dist');
      
      const fileArrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ 
        data: fileArrayBuffer,
        verbosity: 0
      }).promise;
      
      setNumPages(pdf.numPages);
      
      // Page limit for performance
      const maxPages = 10;
      const totalPages = Math.min(pdf.numPages, maxPages);
      
      if (pdf.numPages > maxPages && showNotification) {
        showNotification(`Too many pages, showing first ${maxPages} pages only.`, 'info');
      }
      
      // Convert pages to images
      const pageImages = [];
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.2 });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({ canvasContext: context, viewport }).promise;
          
          const blob = await new Promise(resolve => 
            canvas.toBlob(resolve, 'image/jpeg', 0.8)
          );
          
          pageImages.push(URL.createObjectURL(blob));
          page.cleanup();
        } catch (pageError) {
          console.warn(`Failed to render page ${pageNum}:`, pageError);
          pageImages.push(null);
        }
      }
      
      setPdfPages(pageImages);
      setPageNumber(1); // Reset to first page
      
    } catch (error) {
      console.error('PDF conversion failed:', error);
      if (showNotification) {
        showNotification('Failed to convert PDF to images.', 'error');
      }
      setPdfPages([]);
      setNumPages(null);
    } finally {
      setPdfLoading(false);
    }
  }, [initializePDFWorker, showNotification]);

  // Navigate to specific page
  const goToPage = useCallback((pageNum) => {
    if (pageNum >= 1 && pageNum <= (numPages || pdfPages.length)) {
      setPageNumber(pageNum);
    }
  }, [numPages, pdfPages.length]);

  // Navigate to previous page
  const goToPreviousPage = useCallback(() => {
    if (pageNumber > 1) {
      setPageNumber(prev => prev - 1);
    }
  }, [pageNumber]);

  // Navigate to next page
  const goToNextPage = useCallback(() => {
    const maxPage = numPages || pdfPages.length;
    if (pageNumber < maxPage) {
      setPageNumber(prev => prev + 1);
    }
  }, [pageNumber, numPages, pdfPages.length]);

  // Check navigation availability
  const canGoToPrevious = pageNumber > 1;
  const canGoToNext = pageNumber < (numPages || pdfPages.length);

  // Get current page image URL
  const getCurrentPageUrl = useCallback(() => {
    if (pdfPages.length > 0 && pageNumber <= pdfPages.length) {
      return pdfPages[pageNumber - 1];
    }
    return null;
  }, [pdfPages, pageNumber]);

  // Switch between image and text view modes
  const toggleViewMode = useCallback(() => {
    setDocumentViewMode(prev => prev === 'image' ? 'text' : 'image');
  }, []);

  // Clear PDF data and reset state
  const clearPDF = useCallback(() => {
    // Clean up object URLs to prevent memory leaks
    pdfPages.forEach(pageUrl => {
      if (pageUrl) {
        URL.revokeObjectURL(pageUrl);
      }
    });
    
    setPdfPages([]);
    setNumPages(null);
    setPageNumber(1);
    setPdfLoading(false);
    setDocumentViewMode('image');
  }, [pdfPages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Only clean up on actual unmount
      if (process.env.NODE_ENV === 'production') {
        if (pdfPages.length > 0) {
          const pagesToClean = [...pdfPages];
          setTimeout(() => {
            pagesToClean.forEach(pageUrl => {
              if (pageUrl) {
                URL.revokeObjectURL(pageUrl);
              }
            });
          }, 100);
        }
      }
    };
  }, [pdfPages]);

  return {
    // State
    numPages,
    pageNumber,
    pdfPages,
    pdfLoading,
    documentViewMode,
    
    // Actions
    convertPdfToImages,
    goToPage,
    goToPreviousPage,
    goToNextPage,
    toggleViewMode,
    clearPDF,
    
    // Computed values
    canGoToPrevious,
    canGoToNext,
    getCurrentPageUrl: getCurrentPageUrl(),
    hasPdfPages: pdfPages.length > 0,
    totalPages: numPages || pdfPages.length,
    isImageMode: documentViewMode === 'image',
    isTextMode: documentViewMode === 'text'
  };
};

export default usePDFViewer;