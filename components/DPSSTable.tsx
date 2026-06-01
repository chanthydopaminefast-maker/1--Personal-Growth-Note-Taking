import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, Calendar, AlignLeft, AlignCenter, AlignRight, Highlighter, Type, Settings2, MousePointer2, Minus, Layout, Square, Quote, FileUp, FileDown, Loader2, Wand2, Menu, ChevronLeft, FileText, ChevronDown, ChevronRight, Table, Grid3X3, Columns, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Palette, Italic, Underline, Strikethrough, Indent, Outdent, List, ListOrdered, CheckSquare, MoreHorizontal, Download, Maximize2, Minimize2 } from 'lucide-react';
import { AppData, DPSSTopic } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { callNeuralEngine } from '../services/neuralEngine';
import { PAPER_STYLES } from '../src/styles/paperStyles';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface DPSSTableProps {
  data: AppData;
  onUpdate: (data: AppData) => void;
  onUpdateTopic?: (updatedTopics: DPSSTopic[], topicToSave?: DPSSTopic) => void;
  onOpenSidebar?: () => void;
}

export const DPSSTable: React.FC<DPSSTableProps> = ({ data, onUpdate, onUpdateTopic, onOpenSidebar }) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [pickerPos, setPickerPos] = useState<{ x: number, y: number } | null>(null);
  const [showAllTextColors, setShowAllTextColors] = useState(false);
  const [showAllHighlightColors, setShowAllHighlightColors] = useState(false);
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isToolbarHidden, setIsToolbarHidden] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(window.innerWidth < 768 ? 200 : 300);
  const isResizing = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);

  const exportPDF = async () => {
    if (!editorRef.current) return;
    const activeTopic = data?.dpssTopics?.find((t: DPSSTopic) => t.id === selectedTopicId) || { title: 'Notes' };
    
    const settings = data.settings || { fontSize: 12, fontFamily: "'Inter', sans-serif" };
    const paperStyle = settings.paperStyle || 'none';
    const selectedPaper = PAPER_STYLES.find(s => s.id === paperStyle) || PAPER_STYLES[0];

    const isDark = selectedPaper.id === 'stars' || selectedPaper.id === 'none-dark' || selectedPaper.id === 'none';
    const bgColor = isDark ? '#0f172a' : '#ffffff';
    const textColor = isDark ? '#f8fafc' : '#1e293b';
    const accentColor = '#0284c7';

    // Create a robust container for export with fixed layout width
    const exportContainer = document.createElement('div');
    exportContainer.style.position = 'relative';
    exportContainer.style.zIndex = '999999';
    exportContainer.style.pointerEvents = 'none';
    exportContainer.style.width = '1200px';
    exportContainer.style.boxSizing = 'border-box';
    exportContainer.style.padding = '40px';
    exportContainer.style.backgroundColor = bgColor;
    exportContainer.style.color = textColor;
    exportContainer.style.fontFamily = "'Inter', 'Segoe UI', Arial, sans-serif";
    
    exportContainer.innerHTML = `
      <div style="margin-bottom: 30px; border-bottom: 3px solid ${accentColor}; padding-bottom: 20px;">
        <h1 style="font-size: 26pt; font-weight: 900; color: ${isDark ? '#38bdf8' : '#0f172a'}; margin: 0; line-height: 1.2;">${activeTopic.title}</h1>
        <p style="font-size: 10pt; color: ${isDark ? '#94a3b8' : '#64748b'}; margin-top: 8px; text-transform: uppercase; letter-spacing: 2px;">Strategic Notes Export • ${new Date().toLocaleDateString()}</p>
      </div>
      <div class="note-content" style="line-height: 1.6; font-size: 11.5pt;">
        ${editorRef.current.innerHTML}
      </div>
      <style>
        @page {
          size: A4;
          margin: 1in;
        }
        body {
          background-color: ${bgColor};
          color: ${textColor};
          font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        h1, h2, h3, h4, h5, h6 {
          page-break-after: avoid;
          break-after: avoid;
          color: ${isDark ? '#38bdf8' : '#0f172a'};
        }
        
        /* Prevent slicing lines of text and elements horizontally during page break */
        p, li, tr, th, td, blockquote, pre,
        h1, h2, h3, h4, h5, h6,
        .synthesis-card-wrapper, .qa-board-wrapper,
        .note-content > p, .note-content > div,
        .grid > div, [class*="grid-cols"] > div,
        [style*="border"], [style*="background"] {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .flex { display: flex !important; }
        .grid { display: grid !important; }

        .note-content h1, .note-content h2 { font-size: 18pt; font-weight: 900; margin-top: 25pt; margin-bottom: 12pt; color: ${isDark ? '#38bdf8' : '#0369a1'}; }
        .note-content h3 { font-size: 14pt; font-weight: 800; margin-top: 18pt; margin-bottom: 10pt; color: ${isDark ? '#e2e8f0' : '#1e293b'}; }
        .note-content p { margin-bottom: 12pt; }
        .paper-dots, .paper-grid, .paper-ruled, .paper-engineering { background-image: none !important; background-color: ${isDark ? '#1e293b' : '#f8fafc'} !important; border: 1px solid ${isDark ? '#334155' : '#e2e8f0'} !important; border-radius: 12px !important; padding: 15px !important; }
        .synthesis-card-wrapper, .qa-board-wrapper { border: 2px solid ${isDark ? '#334155' : '#e2e8f0'} !important; border-radius: 15px !important; padding: 20px !important; margin: 20px 0 !important; background-color: ${isDark ? '#1e293b' : '#f8fafc'} !important; color: ${textColor} !important; }
        
        table { width: 100% !important; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid ${isDark ? '#334155' : '#e2e8f0'}; padding: 12px; }
        th { background-color: ${isDark ? '#1e293b' : '#f8fafc'}; font-weight: bold; color: ${isDark ? '#ffffff' : '#000000'}; }
      </style>
    `;

    const opt = {
      margin:       [15, 15, 15, 15] as [number, number, number, number],
      filename:     `${activeTopic.title || 'Notes'}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        windowWidth: 1200,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: bgColor
      },
      jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'landscape' as const },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // Show full-screen loading spinner/overlay to hide the print generation process
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
    overlay.style.color = '#ffffff';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999999';
    overlay.style.fontFamily = "'Inter', sans-serif";
    overlay.innerHTML = `
      <div style="text-align: center;">
        <div style="margin-bottom: 20px; font-size: 20px; font-weight: 900; tracking: tight;">GENERATING DOCUMENT PDF...</div>
        <div style="font-size: 13px; color: #94a3b8; font-weight: bold; margin-bottom: 20px;">Applying professional themes and layout presets</div>
        <div style="display: inline-block; width: 32px; height: 32px; border: 4px solid #38bdf8; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    document.body.appendChild(overlay);

    const originalScrollY = window.scrollY || window.pageYOffset || 0;
    const originalScrollX = window.scrollX || window.pageXOffset || 0;
    window.scrollTo(0, 0);

    document.body.appendChild(exportContainer);

    // Give browser brief window to layout and paint the added container
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      await html2pdf().set(opt).from(exportContainer).save();
    } catch (e) {
      console.error(e);
      alert('Export failed.');
    } finally {
      document.body.removeChild(exportContainer);
      document.body.removeChild(overlay);
      window.scrollTo(originalScrollX, originalScrollY);
    }
  };


  const exportWord = () => {
    if (!editorRef.current) return;
    const activeTopic = data?.dpssTopics?.find((t: DPSSTopic) => t.id === selectedTopicId) || { title: 'Notes' };
    
    const settings = data.settings || { fontSize: 12, fontFamily: "'Inter', sans-serif" };
    const paperStyle = settings.paperStyle || 'none';
    const selectedPaper = PAPER_STYLES.find(s => s.id === paperStyle) || PAPER_STYLES[0];

    const isDark = selectedPaper.id === 'stars' || selectedPaper.id === 'none-dark' || selectedPaper.id === 'none';
    const bgColor = isDark ? '#0f172a' : '#ffffff';
    const textColor = isDark ? '#f8fafc' : '#334155';
    
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page {
            size: A4;
            margin: 1in;
          }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: ${textColor};
            background-color: ${bgColor};
            margin: 0;
            padding: 0;
          }
          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
            break-after: avoid;
            color: ${isDark ? '#38bdf8' : '#0f172a'};
          }
          p, li, tr, .synthesis-card-wrapper, .qa-board-wrapper, table {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          h1 { color: ${isDark ? '#38bdf8' : '#0f172a'}; font-size: 26pt; font-weight: bold; border-bottom: 2pt solid #0369a1; padding-bottom: 10pt; margin-bottom: 20pt; }
          h2 { color: #0369a1; font-size: 18pt; margin-top: 25pt; border-left: 4pt solid #0369a1; padding-left: 10pt; }
          h3 { color: ${isDark ? '#e2e8f0' : '#1e293b'}; font-size: 14pt; margin-top: 15pt; font-weight: bold; }
          p { margin-bottom: 10pt; line-height: 1.5; }
          .synthesis-card-wrapper, .qa-board-wrapper { 
            border: 1pt solid ${isDark ? '#334155' : '#cbd5e1'}; 
            padding: 15pt; 
            margin: 15pt 0; 
            background-color: ${isDark ? '#1e293b' : '#f8fafc'};
            border-radius: 10pt;
            color: ${textColor};
          }
          table { width: 100% !important; border-collapse: collapse; margin: 15pt 0; }
          th, td { border: 1pt solid ${isDark ? '#334155' : '#e2e8f0'}; padding: 8pt; text-align: left; }
          th { background-color: ${isDark ? '#1e293b' : '#f1f5f9'}; font-weight: bold; color: ${isDark ? '#ffffff' : '#000000'}; }
          .paper-dots, .paper-grid, .paper-ruled, .paper-engineering {
            background-color: ${isDark ? '#1e293b' : '#f8fafc'} !important;
            border: 1px solid ${isDark ? '#334155' : '#e2e8f0'} !important;
            padding: 15px !important;
          }
        </style>
      </head>
      <body style="background-color: ${bgColor}; color: ${textColor}; margin: 0; padding: 0;">
        <h1>${activeTopic.title}</h1>
        ${editorRef.current.innerHTML}
      </body>
      </html>
    `;
    
    const blob = new Blob(['\ufeff', header], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeTopic.title || 'Notes'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(150, Math.min(e.clientX - 10, 500));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = 'default';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);
  
  const colors = [
    { name: 'Yellow', value: '#fef3c7' },
    { name: 'Green', value: '#dcfce7' },
    { name: 'Blue', value: '#dbeafe' },
    { name: 'Pink', value: '#fce7f3' },
    { name: 'Orange', value: '#ffedd5' },
    { name: 'Red', value: '#fee2e2' },
    { name: 'Purple', value: '#f3e8ff' },
    { name: 'Teal', value: '#ccfbf1' },
    { name: 'Cyan', value: '#cffafe' },
    { name: 'Lime', value: '#ecfccb' },
    { name: 'Amber', value: '#fef3c7' },
    { name: 'Rose', value: '#ffe4e6' },
    { name: 'Black', value: '#000000' },
    { name: 'White', value: '#ffffff' },
    { name: 'Clear', value: 'transparent' }
  ];

  const textColors = [
    { name: 'Slate', value: '#334155' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Violet', value: '#8b5cf6' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Fuchsia', value: '#d946ef' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Clear', value: 'transparent' }
  ];

  const fontFamilies = [
    { name: 'Modern', value: 'Inter' },
    { name: 'Display (Growth)', value: 'Space Grotesk' },
    { name: 'Elegant', value: 'Playfair Display' },
    { name: 'Technical', value: 'JetBrains Mono' },
    { name: 'Handwritten', value: 'cursive' }
  ];
  
  const dpssSettings = data.settings || { fontSize: 12, fontFamily: "'Inter', sans-serif" };
  const textFontFamily = dpssSettings.textFontFamily || dpssSettings.fontFamily;
  const textFontSize = dpssSettings.textFontSize || dpssSettings.fontSize;
  const paperStyle = dpssSettings.paperStyle || 'none';
  const selectedPaper = PAPER_STYLES.find(s => s.id === paperStyle) || PAPER_STYLES[0];

  const filterTopics = (items: DPSSTopic[]): DPSSTopic[] => {
    return items
      .filter(t => !t.deletedAt)
      .map(t => ({
        ...t,
        content: typeof t.content === 'string' ? t.content : '',
        alignment: t.alignment || 'left',
        children: t.children ? filterTopics(t.children) : []
      }));
  };

  const topics = React.useMemo(() => {
    return filterTopics(data.dpssTopics || []);
  }, [data.dpssTopics]);

  const handleSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // Ensure the selection is within our editor
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        savedRange.current = range.cloneRange();
        
        const container = range.commonAncestorContainer;
        const cardElement = container.nodeType === Node.TEXT_NODE 
          ? container.parentElement?.closest('.synthesis-card-wrapper, .qa-board-wrapper')
          : (container as HTMLElement).closest?.('.synthesis-card-wrapper, .qa-board-wrapper');

        if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
          const rect = range.getBoundingClientRect();
          let x = rect.left + rect.width / 2;
          let y = rect.top - 50;
          if ((rect.width === 0 || rect.height === 0) && cardElement) {
            const cardRect = (cardElement as HTMLElement).getBoundingClientRect();
            x = cardRect.left + cardRect.width / 2;
            y = cardRect.top - 40;
          }
          setPickerPos({ x, y });
        } else {
          setPickerPos(null);
        }
      }
    } else {
      // Don't clear immediately if we're clicking the picker
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
           setPickerPos(null);
        }
      }, 100);
    }
  };

  const applyTextColor = (color: string, selectionProvided: boolean = false) => {
    const selection = window.getSelection();
    if (!selection) return;

    if (!selectionProvided) {
      if (!savedRange.current) return;
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    }
    
    if (color === 'transparent') {
      document.execCommand('removeFormat', false, undefined);
    } else {
      document.execCommand('foreColor', false, color);
    }
    
    // Cleanup
    if (!selectionProvided) {
      selection.removeAllRanges();
      savedRange.current = null;
      setPickerPos(null);
    }
  };

  const applyColor = (color: string, selectionProvided: boolean = false) => {
    const selection = window.getSelection();
    if (!selection) return;

    if (!selectionProvided) {
      if (!savedRange.current) return;
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    }
    
    if (color === 'transparent') {
      document.execCommand('removeFormat', false, undefined);
    } else {
      document.execCommand('backColor', false, color);
    }
    
    // Cleanup
    if (!selectionProvided) {
      selection.removeAllRanges();
      savedRange.current = null;
      setPickerPos(null);
    }
  };

  const updateGlobalSettings = (updates: any) => {
    onUpdate({
      ...data,
      settings: { ...dpssSettings, ...updates }
    });
  };

  const findTopic = (items: DPSSTopic[], id: string): DPSSTopic | null => {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findTopic(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const findRootTopic = (items: DPSSTopic[], childId: string): DPSSTopic | null => {
    for (const item of items) {
      if (item.id === childId) return item;
      const found = findTopic(item.children || [], childId);
      if (found) return item;
    }
    return null;
  };

  const addTopic = (parentId?: string) => {
    const newTopic: DPSSTopic = { id: uuidv4(), title: 'New Topic', content: '', alignment: 'left' };
    const updateTopics = (items: DPSSTopic[]): DPSSTopic[] => {
      if (!parentId) return [...items, newTopic];
      return items.map(item => {
        if (item.id === parentId) return { ...item, children: [...(item.children || []), newTopic] };
        if (item.children) return { ...item, children: updateTopics(item.children) };
        return item;
      });
    };
    const updated = updateTopics(data.dpssTopics || []);
    if (onUpdateTopic) {
      if (!parentId) {
        onUpdateTopic(updated, newTopic);
      } else {
        const root = findRootTopic(updated, parentId);
        onUpdateTopic(updated, root || undefined);
      }
    } else {
      onUpdate({ ...data, dpssTopics: updated });
    }
  };

  const deleteTopic = (id: string) => {
    if (confirm('Move this topic to Recycle Bin?')) {
      const markDeleted = (items: DPSSTopic[]): DPSSTopic[] => {
        return items.map(item => {
          if (item.id === id) return { ...item, deletedAt: new Date().toISOString() };
          if (item.children) return { ...item, children: markDeleted(item.children) };
          return item;
        });
      };
      const updatedData = markDeleted(data.dpssTopics || []);
      const root = findRootTopic(data.dpssTopics || [], id); // Find root in old data to know which doc to update
      
      const updatedRoot = root ? findRootTopic(updatedData, root.id) : null;

      if (onUpdateTopic) {
        onUpdateTopic(updatedData, updatedRoot || undefined);
      } else {
        onUpdate({ ...data, dpssTopics: updatedData });
      }
      setSelectedTopicId(null);
    }
  };

  const updateTopic = (id: string, updates: Partial<DPSSTopic>) => {
    const updateItems = (items: DPSSTopic[]): DPSSTopic[] => {
      return items.map(item => {
        if (item.id === id) return { ...item, ...updates };
        if (item.children) return { ...item, children: updateItems(item.children) };
        return item;
      });
    };
    const updated = updateItems(data.dpssTopics || []);
    const root = findRootTopic(updated, id);
    if (onUpdateTopic) {
      onUpdateTopic(updated, root || undefined);
    } else {
      onUpdate({ ...data, dpssTopics: updated });
    }
  };

  const selectedTopic = selectedTopicId ? findTopic(topics, selectedTopicId) : null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedTopic) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      let html = '';
      
      try {
        if (file.type.startsWith('image/')) {
            html = `<div style="margin: 15px 0; text-align: center;"><img src="${dataUrl}" alt="uploaded image" style="max-width: 100%; max-height: 400px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);" /></div><p><br></p>`;
        } else if (file.type.startsWith('video/')) {
            html = `<div contenteditable="false" style="margin: 15px 0; text-align: center;"><video controls src="${dataUrl}" style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);"></video></div><p><br></p>`;
        } else if (file.type.startsWith('audio/')) {
            html = `<div contenteditable="false" style="margin: 15px 0; text-align: center; background: rgba(255,255,255,0.4); padding: 15px; border-radius: 50px;"><audio controls src="${dataUrl}" style="width: 100%; outline: none;"></audio></div><p><br></p>`;
        } else {
            // General file link (PDF, MS Word)
            html = `<div contenteditable="false" style="margin: 15px 0; padding: 12px 16px; background: rgba(255, 237, 213, 0.8); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; display: inline-block;">
                <a href="${dataUrl}" download="${file.name}" target="_blank" rel="noopener noreferrer" style="color: #f97316; font-weight: bold; text-decoration: none;">📎 Open/Download: ${file.name}</a>
            </div><p><br></p>`;
        }
        if (editorRef.current) {
          editorRef.current.focus();
          if (savedRange.current) {
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(savedRange.current);
          }
        }
        document.execCommand('insertHTML', false, html);
        if (editorRef.current) {
           updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
        }
      } catch (err) {
        console.error("Storage error:", err);
        alert("File may be too large to save in local storage. Consider using Firebase.");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset
  };

  const insertDate = () => {
    if (!selectedTopic) return;
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const formattedDate = `<div style="color: #f59e0b; font-weight: 800; font-size: 1.2em; border-left: 4px solid #f59e0b; padding-left: 12px; margin: 10px 0;">${dateStr}</div>`;
    const newContent = formattedDate + selectedTopic.content;
    updateTopic(selectedTopic.id, { content: newContent });
    if (editorRef.current) {
        editorRef.current.innerHTML = newContent;
    }
  };

  const insertSynthesisCard = (theme = 'blue') => {
    if (!selectedTopic) return;
    const configs: Record<string, { border: string; bg: string; title: string; desc: string; inner: string }> = {
      blue: { border: '#bfdbfe', bg: '#f0f7ff', title: '#1d4ed8', desc: '#1e3a8a', inner: '#bfdbfe' },
      emerald: { border: '#bbf7d0', bg: '#f0fdf4', title: '#047857', desc: '#064e3b', inner: '#bbf7d0' },
      rose: { border: '#fecdd3', bg: '#fff1f2', title: '#be123c', desc: '#881337', inner: '#fecdd3' },
      gold: { border: '#fef08a', bg: '#fefce8', title: '#a16207', desc: '#713f12', inner: '#fef08a' },
      violet: { border: '#ddd6fe', bg: '#f5f3ff', title: '#6d28d9', desc: '#4c1d95', inner: '#ddd6fe' },
      orange: { border: '#fed7aa', bg: '#fff7ed', title: '#c2410c', desc: '#7c2d12', inner: '#fed7aa' },
      teal: { border: '#99f6e4', bg: '#f0fdfa', title: '#0f766e', desc: '#115e59', inner: '#99f6e4' },
      fuchsia: { border: '#f5d0fe', bg: '#fdf4ff', title: '#a21caf', desc: '#701a75', inner: '#f5d0fe' },
      sky: { border: '#bae6fd', bg: '#f0f9ff', title: '#0369a1', desc: '#0c4a6e', inner: '#bae6fd' },
      slate: { border: '#cbd5e1', bg: '#f8fafc', title: '#334155', desc: '#0f172a', inner: '#cbd5e1' }
    };
    const c = configs[theme] || configs.blue;

    const cardHtml = `
<div class="synthesis-card-wrapper" style="border: 1.5px solid ${c.border}; background-color: ${c.bg}; border-radius: 20px; padding: 20px; margin: 18px 0; font-family: sans-serif; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.04); text-align: left;">
  <div style="font-weight: 955; color: ${c.title}; text-transform: uppercase; font-size: 13px; letter-spacing: 0.05em; margin-bottom: 6px;">
    SYNTHESIS & ACTION PLAN
  </div>
  <div style="font-size: 12px; color: ${c.desc}; font-weight: 700; margin-bottom: 12px; line-height: 1.5;">
    Based on the 7-day audit, define one "Friction Rule" (e.g., "No gaming before 8 PM" or "Delete mobile apps on weekdays") to regain control over your attention.
  </div>
  <div style="background-color: #ffffff; border: 1.5px solid ${c.inner}; border-radius: 12px; padding: 14px; min-height: 70px; color: #0f172a; font-size: 13px;" class="synthesis-box">
    &nbsp;
  </div>
</div>
<p><br></p>
`;

    if (editorRef.current) {
      editorRef.current.focus();
      if (savedRange.current) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(savedRange.current);
      } else {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      document.execCommand('insertHTML', false, cardHtml);
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const insertQABoard = (theme = 'slate') => {
    if (!selectedTopic) return;
    const configs: Record<string, { border: string; bg: string; title: string; desc: string; inner: string }> = {
      slate: { border: '#e2e8f0', bg: '#f8fafc', title: '#475569', desc: '#64748b', inner: '#cbd5e1' },
      emerald: { border: '#bbf7d0', bg: '#f0fdf4', title: '#047857', desc: '#059669', inner: '#86efac' },
      indigo: { border: '#c7d2fe', bg: '#f5f7ff', title: '#4338ca', desc: '#4f46e5', inner: '#a5b4fc' },
      amber: { border: '#fde68a', bg: '#fefce8', title: '#b45309', desc: '#d97706', inner: '#fcd34d' },
      purple: { border: '#e9d5ff', bg: '#faf5ff', title: '#7e22ce', desc: '#9333ea', inner: '#d8b4fe' },
      rose: { border: '#fecdd3', bg: '#fff1f2', title: '#be123c', desc: '#e11d48', inner: '#fda4af' },
      sky: { border: '#bae6fd', bg: '#f0f9ff', title: '#0369a1', desc: '#0284c7', inner: '#7dd3fc' },
      teal: { border: '#99f6e4', bg: '#f0fdfa', title: '#0f766e', desc: '#0d9488', inner: '#5eead4' },
      orange: { border: '#fed7aa', bg: '#fff7ed', title: '#c2410c', desc: '#ea580c', inner: '#fdba74' },
      cyan: { border: '#a5f3fc', bg: '#ecfeff', title: '#0e7490', desc: '#0891b2', inner: '#67e8f9' }
    };
    const c = configs[theme] || configs.slate;

    const qaHtml = `
<div class="qa-board-wrapper" style="border: 1.5px solid ${c.border}; background-color: ${c.bg}; border-radius: 20px; padding: 20px; margin: 18px 0; font-family: sans-serif; box-shadow: 0 4px 12px rgba(148, 163, 184, 0.03); text-align: left;">
  <div style="font-weight: 955; color: ${c.title}; text-transform: uppercase; font-size: 13px; letter-spacing: 0.05em; margin-bottom: 6px;">
    CRITICAL QUESTION & ANSWER BOARD
  </div>
  <div style="font-size: 11px; color: ${c.desc}; font-weight: 600; margin-bottom: 14px;">
    Use this modular layout to establish friction, debug your behaviors, and verify progression criteria.
  </div>
  <div style="display: grid; grid-template-columns: 1fr; gap: 14px;">
    <div style="background-color: #ffffff; border: 1px solid ${c.inner}; border-radius: 14px; padding: 14px;">
      <div style="font-weight: 800; color: #0f172a; font-size: 11px; margin-bottom: 6px; text-transform: uppercase;">Question or Core Prompt</div>
      <div style="font-size: 12px; color: #475569; font-style: italic; margin-bottom: 10px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 6px;">
        Define your prompt here (e.g., "What was the single biggest trigger today?")
      </div>
      <div style="min-height: 40px; font-size: 13px; color: #0f172a;" class="qa-box">
        Write your response here...
      </div>
    </div>
  </div>
</div>
<p><br></p>
`;

    if (editorRef.current) {
      editorRef.current.focus();
      if (savedRange.current) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(savedRange.current);
      } else {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      document.execCommand('insertHTML', false, qaHtml);
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const getActiveCardElement = (): { element: HTMLElement; type: 'synthesis' | 'qa' } | null => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element = container.nodeType === Node.TEXT_NODE 
        ? container.parentElement?.closest('.synthesis-card-wrapper, .qa-board-wrapper')
        : (container as HTMLElement).closest?.('.synthesis-card-wrapper, .qa-board-wrapper');
      
      if (element) {
        const isSynth = element.classList.contains('synthesis-card-wrapper');
        return {
          element: element as HTMLElement,
          type: isSynth ? 'synthesis' : 'qa'
        };
      }
    }
    return null;
  };

  const applyCardColor = (element: HTMLElement, type: 'synthesis' | 'qa', theme: string) => {
    if (type === 'synthesis') {
      const configs: Record<string, { border: string; bg: string; header: string; desc: string; innerBorder: string }> = {
        blue: { border: '#bfdbfe', bg: '#f0f7ff', header: '#1d4ed8', desc: '#1e3a8a', innerBorder: '#bfdbfe' },
        emerald: { border: '#bbf7d0', bg: '#f0fdf4', header: '#047857', desc: '#064e3b', innerBorder: '#bbf7d0' },
        rose: { border: '#fecdd3', bg: '#fff1f2', header: '#be123c', desc: '#881337', innerBorder: '#fecdd3' },
        gold: { border: '#fef08a', bg: '#fefce8', header: '#a16207', desc: '#713f12', innerBorder: '#fef08a' },
        violet: { border: '#ddd6fe', bg: '#f5f3ff', header: '#6d28d9', desc: '#4c1d95', innerBorder: '#ddd6fe' },
        orange: { border: '#fed7aa', bg: '#fff7ed', header: '#c2410c', desc: '#7c2d12', innerBorder: '#fed7aa' },
        teal: { border: '#99f6e4', bg: '#f0fdfa', header: '#0f766e', desc: '#115e59', innerBorder: '#99f6e4' },
        fuchsia: { border: '#f5d0fe', bg: '#fdf4ff', header: '#a21caf', desc: '#701a75', innerBorder: '#f5d0fe' },
        sky: { border: '#bae6fd', bg: '#f0f9ff', header: '#0369a1', desc: '#0c4a6e', innerBorder: '#bae6fd' },
        slate: { border: '#cbd5e1', bg: '#f8fafc', header: '#334155', desc: '#0f172a', innerBorder: '#cbd5e1' }
      };
      const c = configs[theme];
      if (c) {
        element.style.borderColor = c.border;
        element.style.backgroundColor = c.bg;
        
        const headerDiv = element.children[0] as HTMLElement;
        if (headerDiv) headerDiv.style.color = c.header;
        
        const descDiv = element.children[1] as HTMLElement;
        if (descDiv) descDiv.style.color = c.desc;
        
        const innerBox = element.querySelector('.synthesis-box') as HTMLElement;
        if (innerBox) {
          innerBox.style.borderColor = c.innerBorder;
        }
      }
    } else if (type === 'qa') {
      const configs: Record<string, { border: string; bg: string; header: string; desc: string; innerBorder: string }> = {
        slate: { border: '#e2e8f0', bg: '#f8fafc', header: '#475569', desc: '#64748b', innerBorder: '#cbd5e1' },
        emerald: { border: '#bbf7d0', bg: '#f0fdf4', header: '#047857', desc: '#059669', innerBorder: '#86efac' },
        indigo: { border: '#c7d2fe', bg: '#f5f7ff', header: '#4338ca', desc: '#4f46e5', innerBorder: '#a5b4fc' },
        amber: { border: '#fde68a', bg: '#fefce8', header: '#b45309', desc: '#d97706', innerBorder: '#fcd34d' },
        purple: { border: '#e9d5ff', bg: '#faf5ff', header: '#7e22ce', desc: '#9333ea', innerBorder: '#d8b4fe' },
        rose: { border: '#fecdd3', bg: '#fff1f2', header: '#be123c', desc: '#e11d48', innerBorder: '#fda4af' },
        sky: { border: '#bae6fd', bg: '#f0f9ff', header: '#0369a1', desc: '#0284c7', innerBorder: '#7dd3fc' },
        teal: { border: '#99f6e4', bg: '#f0fdfa', header: '#0f766e', desc: '#0d9488', innerBorder: '#5eead4' },
        orange: { border: '#fed7aa', bg: '#fff7ed', header: '#c2410c', desc: '#ea580c', innerBorder: '#fdba74' },
        cyan: { border: '#a5f3fc', bg: '#ecfeff', header: '#0e7490', desc: '#0891b2', innerBorder: '#67e8f9' }
      };
      const c = configs[theme];
      if (c) {
        element.style.borderColor = c.border;
        element.style.backgroundColor = c.bg;
        
        const headerDiv = element.children[0] as HTMLElement;
        if (headerDiv) headerDiv.style.color = c.header;
        
        const descDiv = element.children[1] as HTMLElement;
        if (descDiv) descDiv.style.color = c.desc;
        
        const innerBoxes = element.querySelectorAll('div[style*="background-color: #ffffff"], div[style*="background-color: rgb(255, 255, 255)"], .qa-box');
        innerBoxes.forEach((box) => {
          const hBox = box as HTMLElement;
          hBox.style.borderColor = c.innerBorder;
        });
      }
    }

    if (selectedTopic?.id && editorRef.current) {
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [tableConfig, setTableConfig] = useState({ rows: 5, cols: 2, hasHeader: true, theme: '#f97316', headerTitle: 'New Table' });

  const insertSmartTable = () => {
    const { rows, cols, hasHeader, theme, headerTitle } = tableConfig;
    let html = `<table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 2px solid ${theme}; font-size: 14px; border-radius: 12px; overflow: hidden; display: table;">`;
    
    if (hasHeader) {
      html += `<thead><tr style="background-color: ${theme}; color: white;">
        <th colspan="${cols}" style="padding: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; border: 1px solid rgba(255,255,255,0.2);">${headerTitle}</th>
      </tr></thead>`;
    }

    html += '<tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const isFirstCol = c === 0;
        const cellStyle = `padding: 10px; border: 1px solid ${theme}40; min-height: 24px; transition: background 0.2s;`;
        const content = isFirstCol ? (r + 1).toString() : '';
        const textAlign = isFirstCol ? 'center' : 'left';
        const width = isFirstCol ? '40px' : 'auto';
        html += `<td style="${cellStyle} text-align: ${textAlign}; width: ${width}; font-weight: ${isFirstCol ? '800' : '500'};">${content}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';

    if (editorRef.current) {
      editorRef.current.focus();
      if (savedRange.current) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(savedRange.current);
      }
      document.execCommand('insertHTML', false, html);
      setIsTableModalOpen(false);
    }
  };

  const manageTable = (action: 'row-above' | 'row-below' | 'col-left' | 'col-right' | 'delete-row' | 'delete-col') => {
    const selection = window.getSelection();
    if (!selection || !selection.anchorNode) return;
    
    const cell = (selection.anchorNode as HTMLElement).closest?.('td, th') as HTMLTableCellElement;
    if (!cell) return;
    
    const row = cell.parentElement as HTMLTableRowElement;
    const table = row.closest('table') as HTMLTableElement;
    if (!table) return;

    const rowIndex = row.rowIndex;
    const colIndex = cell.cellIndex;

    if (action === 'row-above') {
      const newRow = table.insertRow(rowIndex);
      for (let i = 0; i < row.cells.length; i++) {
        const newCell = newRow.insertCell(i);
        newCell.style.cssText = row.cells[i].style.cssText;
        newCell.innerHTML = '&nbsp;';
      }
    } else if (action === 'row-below') {
      const newRow = table.insertRow(rowIndex + 1);
      for (let i = 0; i < row.cells.length; i++) {
        const newCell = newRow.insertCell(i);
        newCell.style.cssText = row.cells[i].style.cssText;
        newCell.innerHTML = '&nbsp;';
      }
    } else if (action === 'col-left') {
      for (let i = 0; i < table.rows.length; i++) {
        const r = table.rows[i];
        if (r.cells[0].colSpan > 1) continue; // Skip header spanned rows
        const newCell = r.insertCell(colIndex);
        newCell.style.cssText = cell.style.cssText;
        newCell.innerHTML = '&nbsp;';
      }
    } else if (action === 'col-right') {
      for (let i = 0; i < table.rows.length; i++) {
        const r = table.rows[i];
        if (r.cells[0].colSpan > 1) continue; // Skip header spanned rows
        const newCell = r.insertCell(colIndex + 1);
        newCell.style.cssText = cell.style.cssText;
        newCell.innerHTML = '&nbsp;';
      }
    } else if (action === 'delete-row') {
      table.deleteRow(rowIndex);
    } else if (action === 'delete-col') {
      for (let i = 0; i < table.rows.length; i++) {
        const r = table.rows[i];
        if (r.cells[0].colSpan > 1) continue;
        if (r.cells.length > colIndex) {
          r.deleteCell(colIndex);
        }
      }
    }

    if (editorRef.current) {
      updateTopic(selectedTopic!.id, { content: editorRef.current.innerHTML });
    }
  };

  const enhanceWithAI = async () => {
    if (!selectedTopic || isAILoading) return;

    const selection = window.getSelection();
    let selectedText = '';
    let range: Range | null = null;
    let isSelectionMode = false;

    // Try to get range from active input selection first
    let r: Range | null = null;
    if (selection && selection.rangeCount > 0) {
      const activeRange = selection.getRangeAt(0);
      if (editorRef.current && editorRef.current.contains(activeRange.commonAncestorContainer) && !activeRange.collapsed && activeRange.toString().trim().length > 0) {
        r = activeRange;
      }
    }

    // Fall back to savedRange.current if active selection got blurred or cleared
    if (!r && savedRange.current) {
      if (editorRef.current && editorRef.current.contains(savedRange.current.commonAncestorContainer) && !savedRange.current.collapsed && savedRange.current.toString().trim().length > 0) {
        r = savedRange.current;
      }
    }

    if (r) {
      selectedText = r.toString().trim();
      if (selectedText.length > 0) {
        range = r;
        isSelectionMode = true;
      }
    }

    if (!isSelectionMode) {
      const confirmAll = window.confirm(
        "💡 Tip: To keep your old lessons and summary, highlight (select) a specific paragraph or sentence first to enhance ONLY that selected part.\n\n" +
        "You currently haven't highlighted any text. Do you want to proceed and AI-enhance the ENTIRE note?"
      );
      if (!confirmAll) return;
    }

    setIsAILoading(true);
    try {
        let promptText = '';
        if (isSelectionMode) {
          promptText = `Enhance ONLY this selected part of the note. Improve clarity, fix spelling/grammar, structure cleanly, and expand slightly if helpful. Return the improved version as HTML formatted snippet. Output ONLY valid HTML formatted text without any markdown or code block wrappers. IMPORTANT: Ensure any layout elements use 'w-full' to span the full width. Do NOT use fixed width containers or centered wrappers like 'max-w-md' or 'mx-auto'. Selected text: ${selectedText}`;
        } else {
          promptText = `Enhance this note. Improve structure, fix grammar, and expand slightly if it helps clarity. Return HTML formatted string only. IMPORTANT: Ensure any layout elements use 'w-full' to span the full width. Do NOT use fixed width containers or centered wrappers like 'max-w-md' or 'mx-auto'. Current content: ${selectedTopic.content}`;
        }

        const result = await callNeuralEngine(
            'gemini-3-flash-preview',
            promptText,
            "You are a helpful note-taking assistant. Output ONLY valid HTML formatted text."
        );
        let improved = result.text.trim();
        improved = improved.replace(/^`{3}(html)?\n?/i, '').replace(/`{3}$/, '').trim();
        
        if (isSelectionMode && range && selection) {
          selection.removeAllRanges();
          selection.addRange(range);
          document.execCommand('insertHTML', false, improved);
          
          if (editorRef.current) {
            updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
          }
        } else {
          updateTopic(selectedTopic.id, { content: improved });
          if (editorRef.current) {
              editorRef.current.innerHTML = improved;
          }
        }
    } catch(e) {
        console.error(e);
        alert('Failed to enhance content with AI.');
    } finally {
        setIsAILoading(false);
    }
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute('href');
      const download = anchor.getAttribute('download');
      
      if (href) {
        const link = document.createElement('a');
        link.href = href;
        if (download) link.download = download;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }

    if (target.classList?.contains('task-checkbox') && target.getAttribute('contenteditable') === 'false') {
        const text = target.innerText.trim();
        const toggles: Record<string, string> = {
            '⬜': '✅', '✅': '⬜',
            '[ ]': '[x]', '[x]': '[ ]',
            '🔳': '✅',
            '⚪': '🟢', '🟢': '⚪',
            '🔴': '🟢',
            '❎': '✅',
            '✓': '✗', '✗': '✓'
        };
        if (toggles[text]) {
            target.innerText = toggles[text];
            if (selectedTopic?.id && editorRef.current) {
                updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
            }
        }
    }
  };

  const renderTopic = (topic: DPSSTopic, depth = 0) => (
    <div key={topic.id} style={{ marginLeft: `${depth * 15}px` }}>
      <div 
        onClick={() => {
          setSelectedTopicId(topic.id);
          if (window.innerWidth < 768) setIsSidebarOpen(false);
        }} 
        className={`p-2 my-1 rounded-lg cursor-pointer flex items-center justify-between ${selectedTopicId === topic.id ? 'bg-orange-100/50' : 'bg-white/5 hover:bg-white/10'}`}
      >
        <span className="font-bold text-[13px] text-slate-700 truncate max-w-[180px]">{topic.title}</span>
        <div className='flex gap-1 shrink-0'>
            <button onClick={(e) => { e.stopPropagation(); addTopic(topic.id); }}><Plus size={14} className="text-slate-400 hover:text-green-500"/></button>
            <button onClick={(e) => { e.stopPropagation(); deleteTopic(topic.id); }}><Trash2 size={14} className="text-slate-400 hover:text-red-500"/></button>
        </div>
      </div>
      {topic.children?.map(child => renderTopic(child, depth + 1))}
    </div>
  );

  useEffect(() => {
    if (editorRef.current && selectedTopic) {
      let content = selectedTopic.content || '';
      // Dynamically strip narrow constraints from old generated text so they span full width
      content = content.replace(/max-width:\s*\d+(px|rem|em|vw|%)/gi, 'max-width: 100%');
      content = content.replace(/width:\s*\d+(px|rem|em)(?![^;]*%!important)/gi, 'width: 100%');
      content = content.replace(/margin:\s*0\s+auto/gi, 'margin: 0');
      content = content.replace(/max-w-(xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)/g, 'max-w-full');
      content = content.replace(/\bmx-auto\b/g, '');

      if (editorRef.current.innerHTML !== content) {
        if (document.activeElement !== editorRef.current) {
          editorRef.current.innerHTML = content;
        }
      }
    }
  }, [selectedTopic?.id, selectedTopic?.content]);

  return (
    <div className="flex flex-col md:flex-row h-full md:h-[90vh] w-full p-2 gap-0 overflow-hidden relative">
      {/* Sidebar with Fonts - Mobile Slide-in Logic */}
      <div 
        style={{ width: isSidebarOpen ? `${sidebarWidth}px` : '0px' }}
        className={`
          fixed md:relative inset-y-0 left-0 z-50 md:z-30
          bg-white/95 md:bg-white/10 backdrop-blur-3xl md:backdrop-blur-md 
          rounded-r-3xl md:rounded-3xl overflow-hidden shrink-0 transition-all duration-300 transform
          ${isSidebarOpen ? 'p-4 md:p-6 border-r md:border border-white/20 translate-x-0' : 'p-0 border-none -translate-x-full md:translate-x-0 pointer-events-none opacity-0 select-none hidden md:hidden'}
          flex flex-col gap-4
        `}
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-xl font-black text-slate-800 tracking-tight whitespace-nowrap">Note-taking</h2>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"
          >
            <ChevronLeft size={24} />
          </button>
        </div>

        <button 
          onClick={() => {
            addTopic();
          }} 
          className="w-full py-4 bg-orange-500 text-white rounded-2xl text-[10px] font-black flex items-center justify-center gap-2 hover:bg-orange-600 shadow-xl shadow-orange-500/20 active:scale-95 transition-all shrink-0 whitespace-nowrap"
        >
          <Plus size={18} /> Add New Topic
        </button>

        <div className="flex-1 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
            {topics.map(t => renderTopic(t))}
        </div>
      </div>

      {/* Resize Handle */}
      {isSidebarOpen && (
        <div 
          className="hidden md:block w-1 hover:w-2 bg-transparent hover:bg-orange-500/20 cursor-col-resize z-40 transition-all shrink-0"
          onMouseDown={() => {
            isResizing.current = true;
            document.body.style.cursor = 'col-resize';
          }}
        />
      )}
      
      {/* Editor Area */}
      <div className={`flex-1 bg-transparent rounded-3xl p-4 md:p-6 border border-white/20 relative overflow-hidden flex flex-col ${!isSidebarOpen ? 'w-full' : 'hidden md:flex'}`}>
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-4 top-4 z-[100] p-3 bg-orange-500 text-white rounded-xl shadow-lg hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center"
          >
            <Menu size={24} />
          </button>
        )}
        {selectedTopic ? (
            <div className="space-y-4 h-full flex flex-col">
                <div className="flex items-center gap-2 md:gap-4 px-2">
                  {!isSidebarOpen && <div className="w-12 md:hidden shrink-0" />} {/* Spacer for the absolute menu button */}
                  <input 
                      value={selectedTopic.title} 
                      onChange={(e) => updateTopic(selectedTopic.id, { title: e.target.value })}
                      className="flex-1 text-2xl md:text-4xl font-black text-slate-100 bg-transparent outline-none p-2 border-b-2 border-orange-500/20 focus:border-orange-500 transition-all min-w-0"
                      placeholder="Topic Title..."
                  />
                  <button
                    onClick={() => setIsToolbarHidden(!isToolbarHidden)}
                    className={`p-2 shrink-0 ${isToolbarHidden ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' : 'bg-white/50 text-slate-500 hover:bg-white'} rounded-xl transition-all shadow-sm`}
                    title={isToolbarHidden ? "Show Toolbar" : "Full Screen (Hide Toolbar)"}
                  >
                    {isToolbarHidden ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </button>
                </div>
                
                {!isToolbarHidden && (
                  <div className='flex flex-wrap gap-2 p-2 border-b border-white/20 items-center sticky top-0 bg-white/30 backdrop-blur-xl z-20 rounded-xl'>
                    <div className="flex gap-1 bg-white/40 p-1 rounded-lg shrink-0 items-center">
                      <select 
                        onChange={(e) => {
                          const font = e.target.value;
                          document.execCommand('fontName', false, font);
                        }}
                        className="bg-white px-2 py-1 rounded text-[10px] font-bold border-none outline-none cursor-pointer hover:bg-slate-50 transition-colors"
                        title="Font Family"
                      >
                        {fontFamilies.map(f => (
                          <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.name}</option>
                        ))}
                      </select>

                      <div className="w-px h-6 bg-black/5 mx-1" />

                      <select 
                        onChange={(e) => {
                          const size = e.target.value;
                          // execCommand fontSize is limited to 1-7, so we'll apply style directly to selection
                          const selection = window.getSelection();
                          if (selection?.rangeCount) {
                            const range = selection.getRangeAt(0);
                            const span = document.createElement('span');
                            span.style.fontSize = `${size}px`;
                            range.surroundContents(span);
                          }
                        }}
                        className="bg-white px-2 py-1 rounded text-[10px] font-bold border-none outline-none cursor-pointer hover:bg-slate-50 transition-colors w-14"
                        title="Font Size"
                      >
                        {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map(s => (
                          <option key={s} value={s}>{s}px</option>
                        ))}
                      </select>
                    </div>

                    <div className="h-6 w-px bg-white/30 mx-1" />

                    <div className="flex gap-1 bg-white/40 p-1 rounded-lg shrink-0">
                      <button className="p-1.5 hover:bg-white rounded transition-colors" title="Bold" onClick={() => document.execCommand('bold')}><Plus size={14} className="rotate-45" /> <span className="text-[10px] font-black">B</span></button>
                      <button className="p-1.5 hover:bg-white rounded transition-colors" title="Italic" onClick={() => document.execCommand('italic')}><Italic size={14} /></button>
                      <button className="p-1.5 hover:bg-white rounded transition-colors" title="Underline" onClick={() => document.execCommand('underline')}><Underline size={14} /></button>
                      <button className="p-1.5 hover:bg-white rounded transition-colors" title="Strikethrough" onClick={() => document.execCommand('strikeThrough')}><Strikethrough size={14} /></button>
                    </div>

                    <div className="h-6 w-px bg-white/30 mx-1" />

                    <div className="flex gap-1 bg-white/40 p-1 rounded-lg">
                      <button 
                        className="p-1.5 hover:bg-white rounded transition-colors text-slate-700" 
                        title="Add Box"
                        onClick={() => {
                          const html = `<div style="border: 2px solid #e2e8f0; padding: 20px; border-radius: 16px; margin: 15px 0; background: rgba(255,255,255,0.3);">Box Content...</div><p><br></p>`;
                          document.execCommand('insertHTML', false, html);
                        }}
                      >
                        <Square size={16} />
                      </button>
                      
                      <button 
                        className="p-1.5 hover:bg-white rounded transition-colors text-slate-700" 
                        title="Add Callout Block"
                        onClick={() => {
                          const html = `<div style="background: rgba(248,250,252,0.8); border-left: 6px solid #64748b; padding: 16px; border-radius: 8px; margin: 15px 0; font-style: italic; color: #334155;">Block information...</div><p><br></p>`;
                          document.execCommand('insertHTML', false, html);
                        }}
                      >
                        <Quote size={16} />
                      </button>

                      <button 
                        className="p-1.5 hover:bg-white rounded transition-colors text-slate-700" 
                        title="Add Divider"
                        onClick={() => {
                          const html = `<hr style="border: none; border-top: 2px solid rgba(0,0,0,0.1); margin: 25px 0;"><p><br></p>`;
                          document.execCommand('insertHTML', false, html);
                        }}
                      >
                        <Minus size={16} />
                      </button>

                      <button 
                        className="p-1.5 hover:bg-white rounded transition-colors text-slate-700" 
                        title="Add 2-Column Grid"
                        onClick={() => {
                          const html = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;"><div style="border: 1px dashed rgba(0,0,0,0.1); padding: 15px; border-radius: 12px;">Column 1</div><div style="border: 1px dashed rgba(0,0,0,0.1); padding: 15px; border-radius: 12px;">Column 2</div></div><p><br></p>`;
                          document.execCommand('insertHTML', false, html);
                        }}
                      >
                        <Layout size={16} />
                      </button>

                      <button 
                        className="p-1.5 hover:bg-orange-500 hover:text-white rounded transition-all text-slate-700 font-bold flex items-center gap-1 px-2" 
                        title="Smart Table Builder"
                        onClick={() => setIsTableModalOpen(true)}
                      >
                        <Table size={16} />
                        <span className="text-[10px] uppercase">Table</span>
                      </button>
                    </div>

                    <div className="h-6 w-px bg-white/30 mx-1" />

                    <button 
                      onClick={() => setShowMoreTools(!showMoreTools)}
                      className={`p-1.5 rounded-lg font-black text-[10px] uppercase transition-all flex items-center gap-1 ${showMoreTools ? 'bg-orange-500 text-white shadow-lg' : 'bg-white/40 text-slate-600 hover:bg-white/60'}`}
                    >
                      <Settings2 size={14} className={showMoreTools ? 'animate-spin-slow' : ''} />
                      {showMoreTools ? 'Hide' : 'More'}
                    </button>

                    {showMoreTools && (
                      <div className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                        <div className="h-6 w-px bg-white/30 mx-1" />
                        
                        <div className="flex gap-1 bg-white/40 p-1 rounded-lg shrink-0">
                          <div className="relative group/list z-[150]">
                            <button className="p-1.5 hover:bg-white rounded transition-colors text-slate-700 font-bold text-xs flex items-center gap-1" title="Bullets"><List size={14} /> <span className="text-[10px]">▼</span></button>
                            <div className="absolute hidden group-hover/list:grid grid-cols-5 gap-1 top-full left-0 bg-white shadow-xl border border-slate-200 p-2 rounded-xl z-[200] w-[180px]">
                               {['•','🌹','⭐','🚗','❤️','✅','✨','🔥','🔮','🍃','🎵','👑','☀️','🌙','💎'].map(marker => (
                                 <button key={marker} onClick={() => {
                                    const html = `<ul style="list-style-type: none; padding-left: 20px;"><li>${marker} &nbsp;</li></ul><div><br></div>`;
                                    document.execCommand('insertHTML', false, html);
                                 }} className="p-1 hover:bg-slate-100 rounded text-center text-sm">{marker}</button>
                               ))}
                            </div>
                          </div>

                          <div className="relative group/list2 z-[150]">
                            <button className="p-1.5 hover:bg-white rounded transition-colors text-slate-700 font-bold text-xs flex items-center gap-1" title="Numbers"><ListOrdered size={14} /> <span className="text-[10px]">▼</span></button>
                            <div className="absolute hidden group-hover/list2:flex flex-col gap-1 top-full left-0 bg-white shadow-xl border border-slate-200 p-2 rounded-xl z-[200] w-[120px]">
                               {[ {n: '1.', t: 'decimal'}, {n:'1)', t: 'ol'}, {n:'1-', t: 'ol'}, {n:'I.', t:'upper-roman'}, {n:'i.', t:'lower-roman'}, {n:'A.', t:'upper-alpha'}, {n:'a.', t:'lower-alpha'}, {n:'①', t:'ol'} ].map(marker => (
                                 <button key={marker.n} onClick={() => {
                                    let html = '';
                                    if (marker.t === 'ol') {
                                       html = `<ul style="list-style-type: none; padding-left: 20px;"><li>${marker.n} &nbsp;</li></ul><div><br></div>`;
                                    } else {
                                       html = `<ol style="list-style-type: ${marker.t}; padding-left: 20px;"><li>&nbsp;</li></ol><div><br></div>`;
                                    }
                                    document.execCommand('insertHTML', false, html);
                                 }} className="p-1 hover:bg-slate-100 rounded text-left text-xs font-bold">{marker.n} Type</button>
                               ))}
                            </div>
                          </div>

                          <div className="relative group/list3 z-[150]">
                            <button className="p-1.5 hover:bg-white rounded transition-colors text-slate-700 font-bold text-xs flex items-center gap-1" title="Checklist"><CheckSquare size={14} /> <span className="text-[10px]">▼</span></button>
                            <div className="absolute hidden group-hover/list3:grid grid-cols-2 gap-1 top-full left-0 bg-white shadow-xl border border-slate-200 p-2 rounded-xl z-[200] w-[140px]">
                               {['⬜', '[ ]', '🔳', '⚪', '🔴', '❎', '✓'].map((marker, idx) => (
                                 <button key={idx} onClick={() => {
                                    const html = `<ul style="list-style-type: none; padding-left: 20px;"><li style="display: flex; gap: 8px; align-items: flex-start;"><span contenteditable="false" class="task-checkbox" style="cursor: pointer; user-select: none;">${marker}</span><span>&nbsp;</span></li></ul><div><br></div>`;
                                    document.execCommand('insertHTML', false, html);
                                 }} className="p-1 hover:bg-slate-100 rounded text-center text-xs" dangerouslySetInnerHTML={{__html: marker}}></button>
                               ))}
                            </div>
                          </div>
                        </div>

                        <div className="h-6 w-px bg-white/30 mx-1" />

                        <div className="flex gap-1 bg-white/40 p-1 rounded-lg shrink-0">
                          <button className="p-1.5 hover:bg-white rounded transition-colors" title="Outdent" onClick={() => document.execCommand('outdent')}><Outdent size={14} /></button>
                          <button className="p-1.5 hover:bg-white rounded transition-colors" title="Indent" onClick={() => document.execCommand('indent')}><Indent size={14} /></button>
                        </div>

                        <div className="h-6 w-px bg-white/30 mx-1" />

                        <div className="flex gap-1 bg-white/40 p-1 rounded-lg shrink-0">
                          <button className="p-1.5 hover:bg-white rounded transition-colors" title="Align Left" onClick={() => updateTopic(selectedTopic.id, { alignment: 'left' })}><AlignLeft size={16} /></button>
                          <button className="p-1.5 hover:bg-white rounded transition-colors" title="Align Center" onClick={() => updateTopic(selectedTopic.id, { alignment: 'center' })}><AlignCenter size={16} /></button>
                          <button className="p-1.5 hover:bg-white rounded transition-colors" title="Align Right" onClick={() => updateTopic(selectedTopic.id, { alignment: 'right' })}><AlignRight size={16} /></button>
                        </div>

                        <div className="h-6 w-px bg-white/30 mx-1" />

                        <div className="flex gap-1 bg-white/40 p-1 rounded-lg shrink-0">
                           <button onClick={() => manageTable('row-above')} className="p-1.5 hover:bg-white rounded text-slate-600" title="Insert Row Above"><ArrowUp size={14} /></button>
                           <button onClick={() => manageTable('row-below')} className="p-1.5 hover:bg-white rounded text-slate-600" title="Insert Row Below"><ArrowDown size={14} /></button>
                           <button onClick={() => manageTable('col-left')} className="p-1.5 hover:bg-white rounded text-slate-600" title="Insert Col Left"><ArrowLeft size={14} /></button>
                           <button onClick={() => manageTable('col-right')} className="p-1.5 hover:bg-white rounded text-slate-600" title="Insert Col Right"><ArrowRight size={14} /></button>
                           <div className="w-px h-4 bg-black/10 mx-1 self-center" />
                           <button onClick={() => manageTable('delete-row')} className="p-1.5 hover:bg-red-50 text-red-500 rounded" title="Delete Row"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    )}

                    <div className="h-6 w-px bg-white/30 mx-1" />

                    <div className="flex gap-1 bg-white/40 p-1 rounded-lg shrink-0 overflow-visible z-[150]">
                      <div className="flex items-center gap-2 relative group/textcolor">
                        <button className="flex items-center gap-1 p-0.5 hover:bg-white rounded transition-colors" title="Font Color">
                          <Palette size={14} className="text-slate-600" />
                          <span className="text-[10px] text-slate-500">▼</span>
                        </button>
                        <div className="absolute hidden group-hover/textcolor:grid grid-cols-4 gap-2 top-full right-0 bg-white shadow-xl border border-slate-200 p-2 rounded-xl w-[130px]">
                          {textColors.map(c => (
                            <button
                              key={c.value}
                              onClick={() => applyTextColor(c.value, true)} // assuming main toolbar applies to current selection
                              className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-110 shadow-sm mx-auto border-slate-200`}
                              style={{ backgroundColor: c.value === 'transparent' ? '#f8fafc' : c.value }}
                              title={c.name}
                            >
                              {c.value === 'transparent' && <span className="text-[8px] font-black opacity-30">✕</span>}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="w-px h-4 bg-white/30 self-center mx-1" />

                      <div className="flex items-center gap-2 relative group/color">
                        <button className="flex items-center gap-1 p-0.5 hover:bg-white rounded transition-colors" title="Highlight Color">
                          <Highlighter size={14} className={activeColor ? 'text-orange-500 animate-pulse' : 'text-slate-600'} />
                          <span className="text-[10px] text-slate-500">▼</span>
                        </button>
                        <div className="absolute hidden group-hover/color:grid grid-cols-5 gap-2 top-full right-0 bg-white shadow-xl border border-slate-200 p-2 rounded-xl w-[160px]">
                          {colors.map(c => (
                            <button
                              key={c.value}
                              onClick={() => {
                                setActiveColor(activeColor === c.value ? null : c.value);
                                applyColor(c.value, true); // Apply immediately to selection if any
                              }}
                              className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-110 shadow-sm mx-auto ${activeColor === c.value ? 'border-orange-500 scale-125' : 'border-slate-200'}`}
                              style={{ backgroundColor: c.value === 'transparent' ? '#f8fafc' : c.value }}
                              title={c.name}
                            >
                              {c.value === 'transparent' && <span className="text-[8px] font-black opacity-30">✕</span>}
                            </button>
                          ))}
                        </div>
                        {activeColor && (
                          <button onClick={() => setActiveColor(null)} className="text-[9px] font-black bg-white/60 hover:bg-white px-1.5 rounded uppercase tracking-tighter text-slate-500">
                            Stop
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="h-6 w-px bg-white/30 mx-1" />
                    
                    <div className="flex gap-1 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded-lg border border-blue-500/30 transition-all">
                      <label 
                        className="p-1 hover:bg-white/50 rounded flex items-center justify-center gap-2 cursor-pointer text-blue-700 font-bold text-xs" 
                        title="Upload File / Media (PDF, Images, MP3, MP4, Docs)"
                      >
                        <FileUp size={16} className="text-blue-600" />
                        <span>Upload File</span>
                        <input 
                          type="file" 
                          accept=".pdf,.doc,.docx,.xls,.xlsx,image/*,audio/*,video/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
                      <button 
                        onClick={enhanceWithAI} 
                        onMouseDown={(e) => e.preventDefault()}
                        disabled={isAILoading} 
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-bold hover:bg-indigo-600 shadow-sm transition-colors disabled:opacity-50 font-sans"
                        title="Highlight/select some text first to only enhance that selection, or do not select anything to enhance the entire note."
                      >
                        {isAILoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                        AI Enhance
                      </button>
                      <div className="relative z-[200]">
                        <button 
                          onClick={() => setShowMoreMenu(!showMoreMenu)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold shadow-sm transition-all font-sans"
                          title="More rich layouts & templates"
                        >
                          <MoreHorizontal size={14} />
                          More
                          <ChevronDown size={12} className={`transition-transform duration-200 ${showMoreMenu ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showMoreMenu && (
                          <div className="absolute right-0 top-full mt-2 z-[250] w-[210px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-150">
                            <div>
                              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                                <Layout size={12} className="text-blue-500" />
                                Insert Synthesis Card
                              </div>
                              <div className="grid grid-cols-5 gap-1.5">
                                {[
                                  { key: 'blue', color: 'bg-blue-500', border: 'border-blue-200', bg: 'bg-blue-50', name: 'Blue' },
                                  { key: 'emerald', color: 'bg-emerald-500', border: 'border-emerald-200', bg: 'bg-emerald-50', name: 'Emerald' },
                                  { key: 'rose', color: 'bg-rose-500', border: 'border-rose-200', bg: 'bg-rose-50', name: 'Rose' },
                                  { key: 'gold', color: 'bg-yellow-500', border: 'border-yellow-200', bg: 'bg-yellow-50', name: 'Gold' },
                                  { key: 'violet', color: 'bg-purple-500', border: 'border-purple-200', bg: 'bg-purple-50', name: 'Violet' },
                                  { key: 'orange', color: 'bg-orange-500', border: 'border-orange-200', bg: 'bg-orange-50', name: 'Orange' },
                                  { key: 'teal', color: 'bg-teal-500', border: 'border-teal-200', bg: 'bg-teal-50', name: 'Teal' },
                                  { key: 'fuchsia', color: 'bg-fuchsia-500', border: 'border-fuchsia-200', bg: 'bg-fuchsia-50', name: 'Fuchsia' },
                                  { key: 'sky', color: 'bg-sky-500', border: 'border-sky-200', bg: 'bg-sky-50', name: 'Sky' },
                                  { key: 'slate', color: 'bg-slate-500', border: 'border-slate-300', bg: 'bg-slate-50', name: 'Slate' }
                                ].map((theme) => (
                                  <button 
                                    key={theme.key}
                                    onClick={() => { insertSynthesisCard(theme.key); setShowMoreMenu(false); }}
                                    className={`w-7 h-7 rounded-full border ${theme.border} ${theme.bg} flex items-center justify-center hover:scale-110 active:scale-95 transition-all animate-in zoom-in-50 duration-200`}
                                    title={`${theme.name} Synthesis Card`}
                                  >
                                    <span className={`w-3 h-3 rounded-full ${theme.color}`} />
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="h-px bg-slate-100" />

                            <div>
                              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                                <CheckSquare size={12} className="text-slate-600" />
                                Insert Q&A Board
                              </div>
                              <div className="grid grid-cols-5 gap-1.5">
                                {[
                                  { key: 'slate', color: 'bg-slate-500', border: 'border-slate-200', bg: 'bg-slate-50', name: 'Slate' },
                                  { key: 'emerald', color: 'bg-emerald-500', border: 'border-emerald-200', bg: 'bg-emerald-50', name: 'Emerald' },
                                  { key: 'indigo', color: 'bg-indigo-500', border: 'border-indigo-200', bg: 'bg-indigo-50', name: 'Indigo' },
                                  { key: 'amber', color: 'bg-amber-500', border: 'border-amber-200', bg: 'bg-amber-50', name: 'Amber' },
                                  { key: 'purple', color: 'bg-purple-500', border: 'border-purple-200', bg: 'bg-purple-50', name: 'Purple' },
                                  { key: 'rose', color: 'bg-rose-500', border: 'border-rose-200', bg: 'bg-rose-50', name: 'Rose' },
                                  { key: 'sky', color: 'bg-sky-505', border: 'bg-sky-50', name: 'Sky' },
                                  { key: 'teal', color: 'bg-teal-500', border: 'border-teal-200', bg: 'bg-teal-50', name: 'Teal' },
                                  { key: 'orange', color: 'bg-orange-500', border: 'border-orange-200', bg: 'bg-orange-50', name: 'Orange' },
                                  { key: 'cyan', color: 'bg-cyan-505', border: 'bg-cyan-50', name: 'Cyan' }
                                ].map((theme) => (
                                  <button 
                                    key={theme.key}
                                    onClick={() => { insertQABoard(theme.key); setShowMoreMenu(false); }}
                                    className={`w-7 h-7 rounded-full border ${theme.border} ${theme.bg} flex items-center justify-center hover:scale-110 active:scale-95 transition-all animate-in zoom-in-50 duration-200`}
                                    title={`${theme.name} Q&A Board`}
                                  >
                                    <span className={`w-3 h-3 rounded-full ${theme.color}`} />
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="relative z-[200]">
                        <button 
                          onClick={() => setShowExportMenu(!showExportMenu)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold shadow-sm transition-all font-sans"
                          title="Export notes"
                        >
                          <Download size={14} />
                          Export
                          <ChevronDown size={12} className={`transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showExportMenu && (
                          <div className="absolute right-0 top-full mt-2 z-[250] w-[180px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 flex flex-col gap-1 animate-in slide-in-from-top-2 duration-150">
                            <button 
                              onClick={() => { exportWord(); setShowExportMenu(false); }}
                              className="flex items-center justify-between w-full text-left px-3 py-2 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl transition-colors font-bold text-xs"
                            >
                              <span className="flex items-center gap-2">
                                <FileText size={14} className="text-blue-500" /> MS Word (.doc)
                              </span>
                            </button>
                            <button 
                              onClick={() => { exportPDF(); setShowExportMenu(false); }}
                              className="flex items-center justify-between w-full text-left px-3 py-2 hover:bg-red-50 text-slate-700 hover:text-red-700 rounded-xl transition-colors font-bold text-xs"
                            >
                              <span className="flex items-center gap-2">
                                <FileDown size={14} className="text-red-500" /> PDF Document
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                      <button onClick={insertDate} className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 shadow-sm transition-colors">
                        <Calendar size={14} /> Insert Date
                      </button>
                    </div>
                </div>
                )}

                {pickerPos && (() => {
                  const activeCard = getActiveCardElement();
                  return (
                    <div 
                      className="fixed z-50 bg-white/95 backdrop-blur p-2.5 rounded-2xl shadow-2xl border border-slate-100 flex gap-3 animate-in fade-in zoom-in slide-in-from-bottom-2 duration-200 items-center"
                      style={{ 
                        left: pickerPos.x, 
                        top: pickerPos.y, 
                        transform: 'translateX(-50%)' 
                      }}
                      onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
                    >
                      {activeCard && (
                        <>
                          <div className="flex gap-2 items-center">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Card Color</span>
                            <div className="grid grid-cols-5 gap-1">
                              {activeCard.type === 'synthesis' ? (
                                <>
                                  {[
                                    { key: 'blue', color: 'bg-blue-500', name: 'Blue (Default)' },
                                    { key: 'emerald', color: 'bg-emerald-500', name: 'Emerald' },
                                    { key: 'rose', color: 'bg-rose-500', name: 'Rose' },
                                    { key: 'gold', color: 'bg-yellow-400', name: 'Gold' },
                                    { key: 'violet', color: 'bg-purple-500', name: 'Violet' },
                                    { key: 'orange', color: 'bg-orange-500', name: 'Orange' },
                                    { key: 'teal', color: 'bg-teal-500', name: 'Teal' },
                                    { key: 'fuchsia', color: 'bg-fuchsia-500', name: 'Fuchsia' },
                                    { key: 'sky', color: 'bg-sky-500', name: 'Sky' },
                                    { key: 'slate', color: 'bg-slate-500', name: 'Slate' }
                                  ].map((theme) => (
                                    <button
                                      key={theme.key}
                                      onClick={() => applyCardColor(activeCard.element, 'synthesis', theme.key)}
                                      className={`w-5 h-5 rounded-full border border-black/10 ${theme.color} hover:scale-115 transition-all`}
                                      title={theme.name}
                                    />
                                  ))}
                                </>
                              ) : (
                                <>
                                  {[
                                    { key: 'slate', color: 'bg-slate-500', name: 'Slate (Default)' },
                                    { key: 'emerald', color: 'bg-emerald-500', name: 'Emerald' },
                                    { key: 'indigo', color: 'bg-indigo-500', name: 'Indigo' },
                                    { key: 'amber', color: 'bg-amber-500', name: 'Amber' },
                                    { key: 'purple', color: 'bg-purple-500', name: 'Purple' },
                                    { key: 'rose', color: 'bg-rose-500', name: 'Rose' },
                                    { key: 'sky', color: 'bg-sky-500', name: 'Sky' },
                                    { key: 'teal', color: 'bg-teal-500', name: 'Teal' },
                                    { key: 'orange', color: 'bg-orange-500', name: 'Orange' },
                                    { key: 'cyan', color: 'bg-cyan-500', name: 'Cyan' }
                                  ].map((theme) => (
                                    <button
                                      key={theme.key}
                                      onClick={() => applyCardColor(activeCard.element, 'qa', theme.key)}
                                      className={`w-5 h-5 rounded-full border border-black/10 ${theme.color} hover:scale-115 transition-all`}
                                      title={theme.name}
                                    />
                                  ))}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="w-px h-5 bg-slate-200 self-center" />
                        </>
                      )}
                      
                      <div className="flex gap-2 items-center">
                        <Palette size={14} className="text-slate-400 shrink-0" />
                        <div className="flex gap-1 flex-wrap items-center">
                          {(showAllTextColors ? textColors : textColors.slice(0, 6)).map(color => (
                              <button 
                                  key={color.value}
                                  className={`w-5 h-5 rounded-full border border-black/5 hover:scale-110 transition-transform cursor-pointer shrink-0 ${color.value === 'transparent' ? 'bg-slate-100 flex items-center justify-center' : ''}`}
                                  style={{ backgroundColor: color.value === 'transparent' ? 'transparent' : color.value }}
                                  onClick={() => applyTextColor(color.value)}
                                  title={color.name}
                              >
                                {color.value === 'transparent' && <span className="text-[8px] font-black opacity-40">✕</span>}
                              </button>
                          ))}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setShowAllTextColors(!showAllTextColors);
                            }}
                            className="text-[9px] font-black uppercase text-slate-500 hover:text-indigo-600 bg-slate-100/80 hover:bg-slate-100 px-1.5 py-0.5 rounded-md transition-all shrink-0 ml-1 cursor-pointer"
                            title={showAllTextColors ? "Show Less" : "Show More Colors"}
                          >
                            {showAllTextColors ? 'Less' : 'More+'}
                          </button>
                        </div>
                      </div>
                      <div className="w-px h-5 bg-slate-200 self-center shrink-0" />
                      <div className="flex gap-2 items-center">
                        <Highlighter size={14} className="text-slate-400 shrink-0" />
                        <div className="flex gap-1 flex-wrap items-center">
                          {(showAllHighlightColors ? colors : colors.slice(0, 6)).map(color => (
                              <button 
                                  key={color.value}
                                  className={`w-5 h-5 rounded-full border border-black/5 hover:scale-110 transition-transform cursor-pointer shrink-0 ${color.value === 'transparent' ? 'bg-slate-100 flex items-center justify-center' : ''}`}
                                  style={{ backgroundColor: color.value === 'transparent' ? 'transparent' : color.value }}
                                  onClick={() => applyColor(color.value)}
                                  title={color.name}
                              >
                                {color.value === 'transparent' && <span className="text-[8px] font-black opacity-40">✕</span>}
                              </button>
                          ))}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setShowAllHighlightColors(!showAllHighlightColors);
                            }}
                            className="text-[9px] font-black uppercase text-slate-500 hover:text-indigo-600 bg-slate-100/80 hover:bg-slate-100 px-1.5 py-0.5 rounded-md transition-all shrink-0 ml-1 cursor-pointer"
                            title={showAllHighlightColors ? "Show Less" : "Show More Colors"}
                          >
                            {showAllHighlightColors ? 'Less' : 'More+'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const isDarkPaper = selectedPaper.id === 'stars' || selectedPaper.id === 'none';
                  const editorTextColor = isDarkPaper ? '#f8fafc' : '#1e293b';
                  const editorHeaderColor = isDarkPaper ? '#ffedd5' : '#0f172a';
                  const editorBorderColor = isDarkPaper ? '#475569' : '#cbd5e1';
                  const editorCardBgColor = isDarkPaper ? 'rgba(30, 41, 59, 0.8)' : 'rgba(254, 243, 199, 0.8)';
                  
                  return (
                    <style dangerouslySetInnerHTML={{ __html: `
                      .editor-content {
                        color: ${editorTextColor} !important;
                      }
                      
                      .editor-content p, 
                      .editor-content li, 
                      .editor-content span, 
                      .editor-content div, 
                      .editor-content font,
                      .editor-content td, 
                      .editor-content th, 
                      .editor-content blockquote {
                        color: ${editorTextColor};
                      }
                      
                      ${isDarkPaper ? `
                        .editor-content .text-slate-900,
                        .editor-content .text-slate-800,
                        .editor-content .text-slate-700,
                        .editor-content .text-slate-600,
                        .editor-content .text-gray-900,
                        .editor-content .text-gray-800,
                        .editor-content .text-neutral-900,
                        .editor-content .text-black,
                        .editor-content [class*="text-slate-"],
                        .editor-content [class*="text-gray-"],
                        .editor-content [class*="text-neutral-"] {
                          color: ${editorTextColor} !important;
                        }
                      ` : `
                        .editor-content .text-slate-100,
                        .editor-content .text-white,
                        .editor-content [class*="text-slate-100"] {
                          color: ${editorTextColor} !important;
                        }
                      `}
                      
                      .editor-content h1, 
                      .editor-content h2, 
                      .editor-content h3, 
                      .editor-content h4, 
                      .editor-content h5, 
                      .editor-content h6 {
                        color: ${editorHeaderColor} !important;
                        font-weight: 800 !important;
                      }
                      
                      .editor-content th, 
                      .editor-content td {
                        border: 1px solid ${editorBorderColor} !important;
                        padding: 10px !important;
                        color: ${editorTextColor} !important;
                      }
                      
                      .editor-content .synthesis-card-wrapper, 
                      .editor-content .qa-board-wrapper,
                      .editor-content .study-plan-card,
                      .editor-content .action-plan-card {
                        border: 2px solid ${editorBorderColor} !important;
                        background-color: ${editorCardBgColor} !important;
                        color: ${editorTextColor} !important;
                        border-radius: 16px !important;
                        padding: 18px !important;
                      }

                      .editor-content a {
                        color: #f97316 !important;
                        text-decoration: underline !important;
                        font-weight: 700 !important;
                      }

                      .editor-content ul {
                        list-style-type: disc !important;
                        padding-left: 20px !important;
                        margin-bottom: 10px !important;
                      }
                      .editor-content ol {
                        list-style-type: decimal !important;
                        padding-left: 20px !important;
                        margin-bottom: 10px !important;
                      }
                    ` }} />
                  );
                })()}

                <div 
                    ref={editorRef}
                    contentEditable={true}
                    onClick={handleEditorClick}
                    onMouseUp={handleSelection}
                    onKeyUp={handleSelection}
                    onBlur={(e) => {
                      updateTopic(selectedTopic.id, { content: e.currentTarget.innerHTML });
                    }}
                    style={{ 
                      textAlign: selectedTopic.alignment, 
                      minHeight: '300px',
                      fontSize: `${textFontSize}px`,
                      fontFamily: textFontFamily
                    }}
                    className={`editor-content w-full flex-1 outline-none p-8 rounded-3xl ${selectedPaper.id === 'stars' || selectedPaper.id === 'none' ? 'text-slate-100' : 'text-slate-800'} leading-relaxed font-medium transition-all focus:ring-4 focus:ring-orange-500/10 overflow-y-auto shadow-md ${selectedPaper.className}`}
                ></div>

                {isTableModalOpen && (
                  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-md p-8 shadow-2xl border border-slate-200 animate-in zoom-in duration-300">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
                           <Table size={24} strokeWidth={3} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Table Builder</h2>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Design your custom structured grid</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Header topic (Title)</label>
                          <input 
                            type="text" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 outline-none focus:border-orange-500 transition-all"
                            value={tableConfig.headerTitle}
                            onChange={(e) => setTableConfig({...tableConfig, headerTitle: e.target.value})}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Rows</label>
                            <input 
                              type="number" 
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 outline-none focus:border-orange-500"
                              value={tableConfig.rows}
                              onChange={(e) => setTableConfig({...tableConfig, rows: parseInt(e.target.value) || 1})}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Columns</label>
                            <select 
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 outline-none focus:border-orange-500"
                              value={tableConfig.cols}
                              onChange={(e) => setTableConfig({...tableConfig, cols: parseInt(e.target.value)})}
                            >
                              {[2, 3, 4, 5, 6, 8, 10].map(n => <option key={n} value={n}>{n} Columns</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 py-2">
                           <input 
                             type="checkbox" 
                             id="hasHeader" 
                             checked={tableConfig.hasHeader}
                             onChange={(e) => setTableConfig({...tableConfig, hasHeader: e.target.checked})}
                             className="w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                           />
                           <label htmlFor="hasHeader" className="text-sm font-bold text-slate-700 cursor-pointer">Include Header Row</label>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Theme Color</label>
                          <div className="flex gap-2">
                             {['#f97316', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#000000', '#ffffff', '#64748b', '#f43f5e', '#d946ef', '#14b8a6', '#0ea5e9', '#84cc16', '#eab308', '#ec4899'].map(c => (
                               <button 
                                 key={c}
                                 onClick={() => setTableConfig({...tableConfig, theme: c})}
                                 className={`w-8 h-8 rounded-full border-2 transition-all ${tableConfig.theme === c ? 'border-orange-500 scale-125' : 'border-white'}`}
                                 style={{ backgroundColor: c }}
                               />
                             ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-10">
                        <button 
                          onClick={() => setIsTableModalOpen(false)}
                          className="flex-1 py-4 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={insertSmartTable}
                          className="flex-1 py-4 bg-orange-500 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl shadow-orange-500/20 hover:bg-orange-600 active:scale-95 transition-all"
                        >
                          Generate Table
                        </button>
                      </div>
                    </div>
                  </div>
                )}
            </div>

        ) : (
            <div className="h-full flex flex-col items-center justify-center gap-6 text-slate-400 p-8 text-center bg-white/5 backdrop-blur-sm rounded-[40px] m-4">
                <div className="w-24 h-24 bg-white/40 backdrop-blur-md rounded-[32px] border border-white/60 flex items-center justify-center animate-pulse shadow-xl shadow-slate-200/50">
                    <FileText size={40} className="text-slate-300" />
                </div>
                <div className="space-y-2">
                    <p className="text-sm font-black uppercase tracking-[3px] text-slate-500">Mission Hub Empty</p>
                    <p className="text-[10px] font-bold text-slate-400 max-w-[240px] leading-relaxed uppercase mx-auto">Select a dossier from the local library or initialize a new record via the sidebar menu</p>
                </div>
                <button 
                  onClick={onOpenSidebar}
                  className="px-8 py-3 bg-orange-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[3px] shadow-2xl shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all md:hidden animate-bounce"
                >
                  Open Mission dossier
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default DPSSTable;

