import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, Calendar, AlignLeft, AlignCenter, AlignRight, Highlighter, Type, Settings2, MousePointer2, Minus, Layout, Square, Quote, FileUp, FileDown, Loader2, Wand2, Menu, ChevronLeft, FileText, ChevronDown, ChevronRight, Table, Grid3X3, Columns, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Palette, Italic, Underline, Strikethrough, Indent, Outdent, List, ListOrdered, CheckSquare, MoreHorizontal, Download, Maximize2, Minimize2, Search, Archive, Folder, Star } from 'lucide-react';
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
  const [showTableToolsMenu, setShowTableToolsMenu] = useState(false);
  const [isToolbarHidden, setIsToolbarHidden] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(window.innerWidth < 768 ? 200 : 300);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [isArchiveFolderOpen, setIsArchiveFolderOpen] = useState(false);
  const [activeTableCell, setActiveTableCell] = useState<HTMLTableCellElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isResizing = useRef(false);
  const isResizingTableCol = useRef(false);
  const targetCellRef = useRef<HTMLTableCellElement | null>(null);
  const initialXRef = useRef(0);
  const initialWidthRef = useRef(0);
  const initialNextWidthRef = useRef(0);
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
        <p style="font-size: 10pt; color: ${isDark ? '#94a3b8' : '#64748b'}; margin-top: 8px; text-transform: uppercase; letter-spacing: 2px;">Strategic Notes Export • ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
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
      const newWidth = Math.max(160, Math.min(e.clientX - 10, 600));
      setSidebarWidth(newWidth);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isResizing.current) return;
      if (e.touches && e.touches.length > 0) {
        const clientX = e.touches[0].clientX;
        const maxMobileWidth = Math.min(600, window.innerWidth - 45);
        const newWidth = Math.max(160, Math.min(clientX - 10, maxMobileWidth));
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = 'default';
    };

    const handleTouchEnd = () => {
      isResizing.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
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
  const tableBorderThickness = dpssSettings.tableBorderThickness !== undefined ? dpssSettings.tableBorderThickness : 2;
  const tableBorderColor = dpssSettings.tableBorderColor || '#334155';
  const paperStyle = dpssSettings.paperStyle || 'none';
  const selectedPaper = PAPER_STYLES.find(s => s.id === paperStyle) || PAPER_STYLES[0];

  const filterTopics = (items: DPSSTopic[]): DPSSTopic[] => {
    if (!Array.isArray(items)) return [];
    return items
      .filter(t => t && !t.deletedAt)
      .map(t => ({
        ...t,
        title: typeof t.title === 'string' ? t.title : 'New Topic',
        content: typeof t.content === 'string' ? t.content : '',
        alignment: t.alignment || 'left',
        children: t.children ? filterTopics(t.children) : []
      }));
  };

  const filterActiveTopics = (items: DPSSTopic[]): DPSSTopic[] => {
    if (!Array.isArray(items)) return [];
    return items
      .filter(t => t && !t.deletedAt && !t.isArchived)
      .map(t => ({
        ...t,
        title: typeof t.title === 'string' ? t.title : 'New Topic',
        content: typeof t.content === 'string' ? t.content : '',
        alignment: t.alignment || 'left',
        children: t.children ? filterActiveTopics(t.children) : []
      }));
  };

  const getArchivedRootTopics = (items: DPSSTopic[]): DPSSTopic[] => {
    if (!Array.isArray(items)) return [];
    const archived: DPSSTopic[] = [];
    const traverse = (list: DPSSTopic[]) => {
      list.forEach(t => {
        if (t && !t.deletedAt && t.isArchived) {
          archived.push({
            ...t,
            children: t.children ? filterActiveTopics(t.children) : []
          });
        } else if (t && t.children) {
          traverse(t.children);
        }
      });
    };
    traverse(items);
    return archived;
  };

  const topics = React.useMemo(() => {
    return filterTopics(data.dpssTopics || []);
  }, [data.dpssTopics]);

  const activeTopics = React.useMemo(() => {
    return filterActiveTopics(data.dpssTopics || []);
  }, [data.dpssTopics]);

  const archivedTopics = React.useMemo(() => {
    return getArchivedRootTopics(data.dpssTopics || []);
  }, [data.dpssTopics]);

  const filterTopicsBySearch = (items: DPSSTopic[], searchStr: string): DPSSTopic[] => {
    if (!searchStr) return items;
    const cleanSearch = searchStr.toLowerCase().trim();
    
    return items.map(item => {
      const isMatched = item.title.toLowerCase().includes(cleanSearch);
      const filteredChildren = item.children ? filterTopicsBySearch(item.children, searchStr) : [];
      
      if (isMatched || filteredChildren.length > 0) {
        return {
          ...item,
          children: filteredChildren
        };
      }
      return null;
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  };

  const filteredTopics = React.useMemo(() => {
    return filterTopicsBySearch(activeTopics, searchTerm);
  }, [activeTopics, searchTerm]);

  const filteredArchivedTopics = React.useMemo(() => {
    return filterTopicsBySearch(archivedTopics, searchTerm);
  }, [archivedTopics, searchTerm]);

  // Auto-expand matched topics when searching
  useEffect(() => {
    if (searchTerm) {
      const autoExpand = (items: DPSSTopic[]) => {
        const expanded: Record<string, boolean> = {};
        const traverse = (itemList: DPSSTopic[]) => {
          itemList.forEach(item => {
            if (item.children && item.children.length > 0) {
              const matchInDescendants = (i: DPSSTopic): boolean => {
                if (i.title.toLowerCase().includes(searchTerm.toLowerCase())) return true;
                return i.children ? i.children.some(matchInDescendants) : false;
              };
              if (item.children.some(matchInDescendants)) {
                expanded[item.id] = true;
              }
            }
            if (item.children) traverse(item.children);
          });
        };
        traverse(activeTopics);
        setExpandedTopics(prev => ({ ...prev, ...expanded }));
      };
      autoExpand(activeTopics);
    }
  }, [searchTerm, activeTopics]);

  const handleSelection = () => {
    const selection = window.getSelection();
    // Check if selecting inside a table cell
    setTimeout(checkActiveTableCell, 10);

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

  const getCellResizeTarget = (clientX: number, cell: HTMLTableCellElement, threshold: number = 8) => {
    const rect = cell.getBoundingClientRect();
    if (Math.abs(clientX - rect.right) <= threshold) {
      return cell;
    }
    if (Math.abs(clientX - rect.left) <= threshold) {
      return cell.previousElementSibling as HTMLTableCellElement | null;
    }
    return null;
  };

  const hexToRgba = (hex: string, opacity: number) => {
    let c = hex.replace('#', '');
    if (c.length === 3) {
      c = c.split('').map(x => x + x).join('');
    }
    if (c.length === 6) {
      const r = parseInt(c.substring(0, 2), 16);
      const g = parseInt(c.substring(2, 4), 16);
      const b = parseInt(c.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
    }
    return hex;
  };

  const checkActiveTableCell = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const parentEl = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as HTMLElement;
      const cell = parentEl?.closest('td, th') as HTMLTableCellElement | null;
      if (cell && editorRef.current?.contains(cell)) {
        setActiveTableCell(cell);
        return;
      }
    }
    setActiveTableCell(null);
  };

  const addRow = (position: 'above' | 'below') => {
    if (!activeTableCell) return;
    const cell = activeTableCell;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = row?.closest('table');
    if (!table) return;

    ensureTableColgroup(table);
    const colgroup = table.querySelector('colgroup');
    const colsCount = colgroup ? colgroup.querySelectorAll('col').length : row.cells.length;

    const rowIndex = Array.from(table.rows).indexOf(row);
    const targetIdx = position === 'above' ? rowIndex : rowIndex + 1;
    const newRow = table.insertRow(targetIdx);

    for (let c = 0; c < colsCount; c++) {
      const newCell = newRow.insertCell(-1);
      const sourceCell = row.cells[c] || row.cells[row.cells.length - 1] || cell;
      newCell.style.cssText = sourceCell.style.cssText;
      (newCell as HTMLElement).style.width = ''; // Let colgroup handle width permanently

      if (c === 0 && position === 'below') {
        const previousRowsCount = Array.from(table.rows).filter(r => !r.closest('thead')).length;
        newCell.innerHTML = previousRowsCount.toString();
        (newCell as HTMLElement).style.fontWeight = '800';
        (newCell as HTMLElement).style.textAlign = 'center';
      } else {
        newCell.innerHTML = '&nbsp;';
      }
    }

    if (editorRef.current && selectedTopic) {
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const addColumn = (position: 'left' | 'right') => {
    if (!activeTableCell) return;
    const cell = activeTableCell;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = row?.closest('table');
    if (!table) return;

    ensureTableColgroup(table);
    const colgroup = table.querySelector('colgroup');
    if (!colgroup) return;

    const cellsInRow = Array.from(row.cells);
    const clickedCellIdx = cellsInRow.indexOf(cell);
    let colIdx = 0;
    for (let i = 0; i < clickedCellIdx; i++) {
      colIdx += parseInt(cellsInRow[i].getAttribute('colspan') || '1', 10);
    }
    colIdx += parseInt(cell.getAttribute('colspan') || '1', 10) - 1;

    // Add col in colgroup
    const colToInsertBefore = colgroup.children[position === 'left' ? colIdx : colIdx + 1];
    const newCol = document.createElement('col');
    newCol.style.width = '100px';
    if (colToInsertBefore) {
      colgroup.insertBefore(newCol, colToInsertBefore);
    } else {
      colgroup.appendChild(newCol);
    }

    // Add cell in every row inside this table
    Array.from(table.rows).forEach(r => {
      // If it's the <thead> header row spanning all cols, adjust colspan
      const headerCell = r.querySelector('th[colspan]');
      if (headerCell) {
        const currentColspan = parseInt(headerCell.getAttribute('colspan') || '1', 10);
        headerCell.setAttribute('colspan', (currentColspan + 1).toString());
        return;
      }

      // Find the cell index corresponding to colIdx
      let cellIndexToInsert = 0;
      let accumulatedCols = 0;
      const rowCells = Array.from(r.cells);
      for (let i = 0; i < rowCells.length; i++) {
        const span = parseInt(rowCells[i].getAttribute('colspan') || '1', 10);
        if (accumulatedCols + span > colIdx) {
          cellIndexToInsert = position === 'left' ? i : i + 1;
          break;
        }
        accumulatedCols += span;
        cellIndexToInsert = i + 1;
      }

      const newCell = r.insertCell(cellIndexToInsert);
      const sourceCell = rowCells[0] || cell;
      newCell.style.cssText = sourceCell.style.cssText;
      (newCell as HTMLElement).style.width = '';
      newCell.innerHTML = '&nbsp;';
    });

    if (editorRef.current && selectedTopic) {
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const deleteTableElement = (type: 'row' | 'col') => {
    if (!activeTableCell) return;
    const cell = activeTableCell;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = row?.closest('table');
    if (!table) return;

    if (type === 'row') {
      const rowIndex = Array.from(table.rows).indexOf(row);
      // Don't delete header row
      if (row.closest('thead')) return;
      table.deleteRow(rowIndex);
      setActiveTableCell(null);
    } else {
      ensureTableColgroup(table);
      const colgroup = table.querySelector('colgroup');
      if (!colgroup) return;

      const cellsInRow = Array.from(row.cells);
      const clickedCellIdx = cellsInRow.indexOf(cell);
      let colIdx = 0;
      for (let i = 0; i < clickedCellIdx; i++) {
        colIdx += parseInt(cellsInRow[i].getAttribute('colspan') || '1', 10);
      }
      colIdx += parseInt(cell.getAttribute('colspan') || '1', 10) - 1;

      // Delete <col> in colgroup
      if (colgroup.children[colIdx]) {
        colgroup.removeChild(colgroup.children[colIdx]);
      }

      // Delete cell from every row
      Array.from(table.rows).forEach(r => {
        const headerCell = r.querySelector('th[colspan]');
        if (headerCell) {
          const currentColspan = Math.max(1, parseInt(headerCell.getAttribute('colspan') || '1', 10) - 1);
          headerCell.setAttribute('colspan', currentColspan.toString());
          return;
        }

        let cellIndexToDelete = -1;
        let accumulatedCols = 0;
        const rowCells = Array.from(r.cells);
        for (let i = 0; i < rowCells.length; i++) {
          const span = parseInt(rowCells[i].getAttribute('colspan') || '1', 10);
          if (accumulatedCols <= colIdx && colIdx < accumulatedCols + span) {
            cellIndexToDelete = i;
            break;
          }
          accumulatedCols += span;
        }

        if (cellIndexToDelete !== -1) {
          r.deleteCell(cellIndexToDelete);
        }
      });
      setActiveTableCell(null);
    }

    if (editorRef.current && selectedTopic) {
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
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
    selection.removeAllRanges();
    if (!selectionProvided) {
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
    selection.removeAllRanges();
    if (!selectionProvided) {
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
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const formattedDate = `<span style="color: #f59e0b; font-weight: 800; font-family: sans-serif; display: inline-block;">${dateStr}</span>`;
    
    let inserted = false;
    const sel = window.getSelection();
    if (editorRef.current && sel) {
      const activeRange = (sel.rangeCount > 0 ? sel.getRangeAt(0) : null) || savedRange.current;
      if (activeRange && editorRef.current.contains(activeRange.commonAncestorContainer)) {
        editorRef.current.focus();
        sel.removeAllRanges();
        sel.addRange(activeRange);
        activeRange.deleteContents();
        
        const el = document.createElement("span");
        el.innerHTML = formattedDate;
        
        const frag = document.createDocumentFragment();
        let node;
        let lastNode;
        while ((node = el.firstChild)) {
          lastNode = frag.appendChild(node);
        }
        activeRange.insertNode(frag);
        
        if (lastNode) {
          const newRange = activeRange.cloneRange();
          newRange.setStartAfter(lastNode);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          savedRange.current = newRange;
        }
        inserted = true;
      }
    }

    if (!inserted && editorRef.current) {
      const currentContent = editorRef.current.innerHTML || '';
      const spacing = currentContent.trim().length > 0 ? ' &nbsp; ' : '';
      const newContent = currentContent + spacing + formattedDate;
      editorRef.current.innerHTML = newContent;
      updateTopic(selectedTopic.id, { content: newContent });
    } else if (editorRef.current) {
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
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
<div class="synthesis-card-wrapper" style="border: 1.5px solid ${c.border} !important; background-color: ${c.bg} !important; background: ${c.bg} !important; border-radius: 20px; padding: 20px; margin: 18px 0; font-family: sans-serif; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.04); text-align: left;">
  <div style="font-weight: 955; color: ${c.title} !important; text-transform: uppercase; font-size: 13px; letter-spacing: 0.05em; margin-bottom: 6px;">
    SYNTHESIS & ACTION PLAN
  </div>
  <div style="font-size: 12px; color: ${c.desc} !important; font-weight: 750; margin-bottom: 12px; line-height: 1.5;">
    Based on the 7-day audit, define one "Friction Rule" (e.g., "No gaming before 8 PM" or "Delete mobile apps on weekdays") to regain control over your attention.
  </div>
  <div style="background-color: #ffffff !important; background: #ffffff !important; border: 1.5px solid ${c.inner} !important; border-radius: 12px; padding: 14px; min-height: 70px; color: #0f172a !important; font-size: 13px;" class="synthesis-box">
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
<div class="qa-board-wrapper" style="border: 1.5px solid ${c.border} !important; background-color: ${c.bg} !important; background: ${c.bg} !important; border-radius: 20px; padding: 20px; margin: 18px 0; font-family: sans-serif; box-shadow: 0 4px 12px rgba(148, 163, 184, 0.03); text-align: left;">
  <div style="font-weight: 955; color: ${c.title} !important; text-transform: uppercase; font-size: 13px; letter-spacing: 0.05em; margin-bottom: 6px;">
    CRITICAL QUESTION & ANSWER BOARD
  </div>
  <div style="font-size: 11px; color: ${c.desc} !important; font-weight: 600; margin-bottom: 14px;">
    Use this modular layout to establish friction, debug your behaviors, and verify progression criteria.
  </div>
  <div style="display: grid; grid-template-columns: 1fr; gap: 14px;">
    <div style="background-color: #ffffff !important; background: #ffffff !important; border: 1px solid ${c.inner} !important; border-radius: 14px; padding: 14px;">
      <div style="font-weight: 800; color: #0f172a !important; font-size: 11px; margin-bottom: 6px; text-transform: uppercase;">Question or Core Prompt</div>
      <div style="font-size: 12px; color: #475569 !important; font-style: italic; margin-bottom: 10px; border-bottom: 1px dashed #e2e8f0 !important; padding-bottom: 6px;">
        Define your prompt here (e.g., "What was the single biggest trigger today?")
      </div>
      <div style="min-height: 40px; font-size: 13px; color: #0f172a !important;" class="qa-box">
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
        element.style.setProperty('border-color', c.border, 'important');
        element.style.setProperty('background-color', c.bg, 'important');
        element.style.setProperty('background', c.bg, 'important');
        
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
        element.style.setProperty('border-color', c.border, 'important');
        element.style.setProperty('background-color', c.bg, 'important');
        element.style.setProperty('background', c.bg, 'important');
        
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
  const [tableConfig, setTableConfig] = useState({ rows: 5, cols: 2, hasHeader: true, theme: '#f97316', headerTitle: 'New Table', gridOpacity: 100, gridStyle: 'theme-solid' });

  const insertSmartTable = () => {
    const { rows, cols, hasHeader, theme, headerTitle, gridOpacity } = tableConfig;
    const styleType = (tableConfig.gridStyle || 'theme-solid') as 'theme-solid' | 'theme-open' | 'black-solid' | 'black-open';
    const borderRgba = styleType.startsWith('theme') 
      ? hexToRgba(theme, gridOpacity) 
      : `rgba(51, 65, 85, ${gridOpacity / 100})`;

    let tableBorderCss = `border: 2.5px solid ${borderRgba} !important;`;
    if (styleType.endsWith('-open')) {
      tableBorderCss = 'border: none !important;';
    }

    // Outer scrollable container to support phone bar horizontally
    let html = `<p><br></p><div class="table-scroll-container" style="overflow-x: auto; max-width: 100%; -webkit-overflow-scrolling: touch; border-radius: 12px; margin: 8px 0 16px 0; border: ${styleType.endsWith('-open') ? 'none' : `1px solid ${borderRgba}`};">`;
    html += `<table style="width: 100%; border-collapse: collapse; ${tableBorderCss} font-size: 14px; border-radius: 12px; overflow: hidden; display: table; table-layout: fixed;">`;
    
    html += '<colgroup>';
    for (let c = 0; c < cols; c++) {
      const isFirstCol = c === 0;
      const colWidth = isFirstCol ? '60px' : `${Math.floor((100 - 10) / (cols - 1 || 1))}%`;
      html += `<col style="width: ${colWidth};">`;
    }
    html += '</colgroup>';

    if (hasHeader) {
      let headerBorderCss = `border: 2px solid ${borderRgba} !important;`;
      if (styleType.endsWith('-open')) {
        headerBorderCss = `border: none !important; border-bottom: 2px solid ${borderRgba} !important;`;
      }
      html += `<thead><tr style="background-color: ${theme}; color: white;">
        <th colspan="${cols}" style="padding: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; ${headerBorderCss}">${headerTitle}</th>
      </tr></thead>`;
    }

    html += '<tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const isFirstCol = c === 0;
        let cellBorderCss = `border: 2px solid ${borderRgba} !important;`;
        if (styleType.endsWith('-open')) {
          cellBorderCss = `border: none !important; border-bottom: 2px solid ${borderRgba} !important;`;
          if (c < cols - 1) {
            cellBorderCss += ` border-right: 2px solid ${borderRgba} !important;`;
          }
        }
        const cellStyle = `padding: 12px; ${cellBorderCss} min-height: 24px; transition: background 0.2s;`;
        const content = isFirstCol ? (r + 1).toString() : '';
        const textAlign = isFirstCol ? 'center' : 'left';
        html += `<td style="${cellStyle} text-align: ${textAlign}; font-weight: ${isFirstCol ? '800' : '500'};">${content}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table></div><p><br></p>';

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
    setTimeout(checkActiveTableCell, 10);
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

  const focusAndSelectCell = (targetCell: HTMLTableCellElement) => {
    targetCell.focus();
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(targetCell);
      range.collapse(false); // Place cursor at the end
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const ensureTableColgroup = (table: HTMLTableElement) => {
    let colgroup = table.querySelector('colgroup');
    if (!colgroup) {
      let maxCols = 0;
      Array.from(table.rows).forEach(row => {
        let cellsCount = 0;
        Array.from(row.cells).forEach(cell => {
          cellsCount += parseInt(cell.getAttribute('colspan') || '1', 10);
        });
        if (cellsCount > maxCols) {
          maxCols = cellsCount;
        }
      });

      if (maxCols > 0) {
        colgroup = document.createElement('colgroup');
        const regularRow = Array.from(table.rows).find(row => {
          let cCount = 0;
          Array.from(row.cells).forEach(cell => { cCount += parseInt(cell.getAttribute('colspan') || '1', 10); });
          return cCount === maxCols;
        });

        for (let i = 0; i < maxCols; i++) {
          const col = document.createElement('col');
          let colWidth = '150px';
          if (regularRow && regularRow.cells[i]) {
            colWidth = `${regularRow.cells[i].getBoundingClientRect().width}px`;
          }
          col.style.width = colWidth;
          colgroup.appendChild(col);
        }
        table.insertBefore(colgroup, table.firstChild);
      }
    }

    Array.from(table.querySelectorAll('td, th')).forEach(cell => {
      const colSpan = parseInt(cell.getAttribute('colspan') || '1', 10);
      if (colSpan === 1) {
        (cell as HTMLElement).style.width = '';
      }
    });
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    setTimeout(checkActiveTableCell, 20);
    if (e.key === 'Tab') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      const activeNode = selection.anchorNode;
      if (!activeNode) return;
      
      const parentEl = (activeNode as any).parentElement || activeNode.parentNode as HTMLElement | null;
      const activeEl = activeNode.nodeType === Node.ELEMENT_NODE ? (activeNode as HTMLElement) : parentEl;
      const cell = activeEl?.closest?.('td, th') as HTMLTableCellElement | null;
      if (cell) {
        // Prevent browser's default behavior of inserting a tab character or shifting focus out of the editor.
        e.preventDefault();
        
        const row = cell.parentElement as HTMLTableRowElement | null;
        if (!row) return;
        const table = row.closest('table') as HTMLTableElement | null;
        if (!table) return;
        
        // Find all cells (td, th) in the table
        const cells = Array.from(table.querySelectorAll('td, th')) as HTMLTableCellElement[];
        const currentIndex = cells.indexOf(cell);
        
        if (e.shiftKey) {
          // Navigate to previous cell
          if (currentIndex > 0) {
            const prevCell = cells[currentIndex - 1];
            focusAndSelectCell(prevCell);
          }
        } else {
          // Navigate to next cell or append new row if on final cell
          if (currentIndex < cells.length - 1) {
            const nextCell = cells[currentIndex + 1];
            focusAndSelectCell(nextCell);
          } else {
            // Last cell of table! Ensure colgroup is initialized & active style is derived seamlessly
            ensureTableColgroup(table);
            const colgroup = table.querySelector('colgroup');
            const colCount = colgroup ? colgroup.querySelectorAll('col').length : row.cells.length;
            
            const newRow = table.insertRow(-1); // Appends at current end
            const newCells: HTMLTableCellElement[] = [];
            
            for (let c = 0; c < colCount; c++) {
              const newCell = newRow.insertCell(-1);
              const sourceCell = row.cells[c] || row.cells[row.cells.length - 1] || cell;
              newCell.style.cssText = sourceCell.style.cssText;
              newCell.style.width = ''; // Let colgroup handle width permanently!
              
              if (c === 0) {
                const previousRowsCount = Array.from(table.rows).filter(r => !r.closest('thead')).length;
                newCell.innerHTML = previousRowsCount.toString();
                newCell.style.fontWeight = '800';
                newCell.style.textAlign = 'center';
              } else {
                newCell.innerHTML = '<br>'; // Placeholder for cursor focus
              }
              newCells.push(newCell);
            }
            
            if (newCells.length > 0) {
              setTimeout(() => {
                focusAndSelectCell(newCells[0]);
              }, 10);
            }
            
            if (editorRef.current && selectedTopic) {
              updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
            }
          }
        }
      }
    }
  };

  const handleEditorMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isResizingTableCol.current) return;
    
    const target = e.target as HTMLElement;
    const cell = target.closest('td, th') as HTMLTableCellElement | null;
    if (cell) {
      const resizeTarget = getCellResizeTarget(e.clientX, cell, 8);
      if (resizeTarget) {
        cell.style.cursor = 'col-resize';
      } else {
        cell.style.cursor = '';
      }
    }
  };

  const handleEditorMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const clickedCell = target.closest('td, th') as HTMLTableCellElement | null;
    if (!clickedCell) return;
    
    const cell = getCellResizeTarget(e.clientX, clickedCell, 8);
    if (cell) {
      e.preventDefault();
      
      const row = cell.parentElement as HTMLTableRowElement;
      const table = row?.closest('table');
      if (!table) return;

      table.style.tableLayout = 'fixed';
      ensureTableColgroup(table);

      const colgroup = table.querySelector('colgroup');
      if (!colgroup) return;
      const cols = Array.from(colgroup.querySelectorAll('col'));

      const cellsInRow = Array.from(row.cells);
      const clickedCellIdx = cellsInRow.indexOf(cell);
      let colIdx = 0;
      for (let i = 0; i < clickedCellIdx; i++) {
        colIdx += parseInt(cellsInRow[i].getAttribute('colspan') || '1', 10);
      }
      colIdx += parseInt(cell.getAttribute('colspan') || '1', 10) - 1;

      const targetCol = cols[colIdx];
      if (!targetCol) return;

      isResizingTableCol.current = true;
      targetCellRef.current = cell;
      initialXRef.current = e.clientX;
      initialWidthRef.current = targetCol.getBoundingClientRect().width;

      const initialColWidths = cols.map(c => c.getBoundingClientRect().width);

      const handleGlobalMouseMove = (moveEvent: MouseEvent) => {
        if (isResizingTableCol.current && targetCol) {
          const deltaX = moveEvent.clientX - initialXRef.current;
          const newWidth = Math.max(30, initialWidthRef.current + deltaX);
          
          targetCol.style.width = `${newWidth}px`;

          let totalTableWidth = 0;
          cols.forEach((col, idx) => {
            if (idx === colIdx) {
              totalTableWidth += newWidth;
            } else {
              totalTableWidth += initialColWidths[idx] || col.getBoundingClientRect().width;
            }
          });
          table.style.width = `${totalTableWidth}px`;
        }
      };

      const handleGlobalMouseUp = () => {
        isResizingTableCol.current = false;
        targetCellRef.current = null;
        
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
        
        if (editorRef.current && selectedTopic) {
          updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
        }
      };
      
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
  };

  const handleEditorTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const target = touch.target as HTMLElement;
    const clickedCell = target.closest('td, th') as HTMLTableCellElement | null;
    if (clickedCell) {
      const cell = getCellResizeTarget(touch.clientX, clickedCell, 22);
      if (cell) {
        e.preventDefault();
        
        const row = cell.parentElement as HTMLTableRowElement;
        const table = row?.closest('table');
        if (!table) return;

        table.style.tableLayout = 'fixed';
        ensureTableColgroup(table);

        const colgroup = table.querySelector('colgroup');
        if (!colgroup) return;
        const cols = Array.from(colgroup.querySelectorAll('col'));

        const cellsInRow = Array.from(row.cells);
        const clickedCellIdx = cellsInRow.indexOf(cell);
        let colIdx = 0;
        for (let i = 0; i < clickedCellIdx; i++) {
          colIdx += parseInt(cellsInRow[i].getAttribute('colspan') || '1', 10);
        }
        colIdx += parseInt(cell.getAttribute('colspan') || '1', 10) - 1;

        const targetCol = cols[colIdx];
        if (!targetCol) return;

        isResizingTableCol.current = true;
        targetCellRef.current = cell;
        initialXRef.current = touch.clientX;
        initialWidthRef.current = targetCol.getBoundingClientRect().width;

        const initialColWidths = cols.map(c => c.getBoundingClientRect().width);

        const handleGlobalTouchMove = (moveEvt: TouchEvent) => {
          if (isResizingTableCol.current && targetCol && moveEvt.touches.length > 0) {
            const t = moveEvt.touches[0];
            const deltaX = t.clientX - initialXRef.current;
            const newWidth = Math.max(30, initialWidthRef.current + deltaX);
            
            targetCol.style.width = `${newWidth}px`;

            let totalTableWidth = 0;
            cols.forEach((col, idx) => {
              if (idx === colIdx) {
                totalTableWidth += newWidth;
              } else {
                totalTableWidth += initialColWidths[idx] || col.getBoundingClientRect().width;
              }
            });
            table.style.width = `${totalTableWidth}px`;
          }
        };

        const handleGlobalTouchEnd = () => {
          isResizingTableCol.current = false;
          targetCellRef.current = null;
          
          window.removeEventListener('touchmove', handleGlobalTouchMove);
          window.removeEventListener('touchend', handleGlobalTouchEnd);
          
          if (editorRef.current && selectedTopic) {
            updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
          }
        };

        window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
        window.addEventListener('touchend', handleGlobalTouchEnd);
      }
    }
  };

  const getTopicStyles = (id: string, isSelected: boolean) => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      {
        text: 'text-orange-850 dark:text-orange-400 font-bold',
        bg: 'bg-orange-500/5',
        border: 'border-orange-500/20',
        activeBg: 'bg-orange-500/15 border-orange-500/40',
        indicator: 'bg-orange-500',
        iconColor: 'text-orange-500',
        hover: 'hover:bg-orange-500/10'
      },
      {
        text: 'text-indigo-800 dark:text-indigo-400 font-bold',
        bg: 'bg-indigo-500/5',
        border: 'border-indigo-500/20',
        activeBg: 'bg-indigo-500/15 border-indigo-500/40',
        indicator: 'bg-indigo-500',
        iconColor: 'text-indigo-500',
        hover: 'hover:bg-indigo-500/10'
      },
      {
        text: 'text-emerald-800 dark:text-emerald-400 font-bold',
        bg: 'bg-emerald-500/5',
        border: 'border-emerald-500/20',
        activeBg: 'bg-emerald-500/15 border-emerald-500/40',
        indicator: 'bg-emerald-500',
        iconColor: 'text-emerald-500',
        hover: 'hover:bg-emerald-500/10'
      },
      {
        text: 'text-amber-800 dark:text-amber-400 font-bold',
        bg: 'bg-amber-500/5',
        border: 'border-amber-500/20',
        activeBg: 'bg-amber-500/15 border-amber-500/40',
        indicator: 'bg-amber-500',
        iconColor: 'text-amber-500',
        hover: 'hover:bg-amber-500/10'
      },
      {
        text: 'text-rose-800 dark:text-rose-400 font-bold',
        bg: 'bg-rose-500/5',
        border: 'border-rose-500/20',
        activeBg: 'bg-rose-500/15 border-rose-500/40',
        indicator: 'bg-rose-500',
        iconColor: 'text-rose-500',
        hover: 'hover:bg-rose-500/10'
      },
      {
        text: 'text-sky-800 dark:text-sky-400 font-bold',
        bg: 'bg-sky-500/5',
        border: 'border-sky-500/20',
        activeBg: 'bg-sky-500/15 border-sky-500/40',
        indicator: 'bg-sky-500',
        iconColor: 'text-sky-500',
        hover: 'hover:bg-sky-500/10'
      },
      {
        text: 'text-purple-800 dark:text-purple-400 font-bold',
        bg: 'bg-purple-500/5',
        border: 'border-purple-500/20',
        activeBg: 'bg-purple-500/15 border-purple-50 border-purple-500/40',
        indicator: 'bg-purple-500',
        iconColor: 'text-purple-500',
        hover: 'hover:bg-purple-500/10'
      },
      {
        text: 'text-teal-800 dark:text-teal-400 font-bold',
        bg: 'bg-teal-500/5',
        border: 'border-teal-500/20',
        activeBg: 'bg-teal-500/15 border-teal-500/40',
        indicator: 'bg-teal-500',
        iconColor: 'text-teal-500',
        hover: 'hover:bg-teal-500/10'
      }
    ];
    return colors[hash % colors.length];
  };

  const renderTopic = (topic: DPSSTopic, depth = 0): React.ReactNode => {
    const isSelected = selectedTopicId === topic.id;
    const style = getTopicStyles(topic.id, isSelected);
    const hasChildren = topic.children && topic.children.length > 0;
    const isExpanded = !!expandedTopics[topic.id];

    return (
      <div key={topic.id} className="relative select-none" style={{ marginLeft: `${depth * 8}px` }}>
        <div 
          onClick={() => {
            setSelectedTopicId(topic.id);
            if (hasChildren) {
              setExpandedTopics(prev => ({ ...prev, [topic.id]: !prev[topic.id] }));
            }
            if (window.innerWidth < 768) {
              setIsSidebarOpen(false);
            }
          }} 
          className={`group flex items-center justify-between p-2 my-1 rounded-xl cursor-pointer border transition-all ${
            isSelected 
              ? `${style.activeBg} ${style.border} ${style.text} shadow-sm scale-[1.01]` 
              : `bg-white/40 dark:bg-slate-900/10 ${style.border} ${style.text} hover:scale-[1.01] hover:bg-white/70`
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {hasChildren ? (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedTopics(prev => ({ ...prev, [topic.id]: !prev[topic.id] }));
                }}
                className="p-0.5 rounded hover:bg-slate-200/50 dark:hover:bg-slate-800 shrink-0 text-slate-500"
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            ) : (
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.indicator} ml-1.5`} />
            )}
            
            <span className="font-bold text-[12px] truncate flex-1 min-w-0" title={topic.title}>{topic.title}</span>
          </div>

          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => { e.stopPropagation(); addTopic(topic.id); }} 
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-emerald-600 transition-all"
                title="Add nesting sub-topic"
              >
                <Plus size={13} />
              </button>
              
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  updateTopic(topic.id, { isArchived: !topic.isArchived });
                }} 
                className={`p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all ${topic.isArchived ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                title={topic.isArchived ? "Remove from Favorite Stars" : "Add to Favorite Stars"}
              >
                <Star size={13} fill={topic.isArchived ? "currentColor" : "none"} />
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); deleteTopic(topic.id); }} 
                className="p-1 hover:bg-red-50/50 dark:hover:bg-red-950/20 rounded text-slate-400 hover:text-red-500 transition-all"
                title="Delete Topic"
              >
                <Trash2 size={13} />
              </button>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="border-l border-dashed border-slate-200 dark:border-slate-800 ml-2.5 pl-1.5">
            {topic.children!.map(child => renderTopic(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

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
    <div className="flex flex-col md:flex-row h-full md:h-full w-full p-0 gap-0 overflow-hidden relative">
      {/* Sidebar with Fonts - Mobile Slide-in Logic */}
      <div 
        style={{ width: isSidebarOpen ? `${sidebarWidth}px` : '0px' }}
        className={`
          fixed md:relative inset-y-0 left-0 z-50 md:z-30
          bg-white/95 md:bg-white/10 backdrop-blur-3xl md:backdrop-blur-md 
          rounded-r-3xl md:rounded-3xl shrink-0 transition-[transform,opacity] duration-300 transform
          ${isSidebarOpen ? 'p-3 md:p-6 border-r md:border border-white/20 translate-x-0' : 'p-0 border-none -translate-x-full md:translate-x-0 pointer-events-none opacity-0 select-none hidden md:hidden'}
          flex flex-col gap-3 md:gap-4 max-[767px]:landscape:gap-2 relative select-none
        `}
      >
        <div className="flex items-center justify-between mb-2 shrink-0">
          <h2 className="text-xl font-black text-slate-800 tracking-tight whitespace-nowrap">Note-taking</h2>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"
          >
            <ChevronLeft size={24} />
          </button>
        </div>

        {/* Unifed Scrollable Column containing action buttons, search, topics, and folder archive */}
        <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-3 max-[767px]:landscape:space-y-2.5 custom-scrollbar flex flex-col">
          <div className="flex flex-col max-[767px]:landscape:flex-row gap-2 shrink-0">
            <button 
              onClick={() => {
                addTopic();
              }} 
              className="flex-1 py-3 bg-orange-500 text-white rounded-2xl text-[10px] font-black flex items-center justify-center gap-1.5 hover:bg-orange-600 shadow-xl shadow-orange-500/20 active:scale-95 transition-all whitespace-nowrap"
            >
              <Plus size={16} /> Add New Topic
            </button>

            {/* Search Bar */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Active Topics */}
          <div className="space-y-1">
            {filteredTopics.length > 0 ? (
              filteredTopics.map(t => renderTopic(t))
            ) : (
              <div className="text-center py-6 text-xs text-slate-400 select-none">
                {searchTerm ? 'No matching note topics found' : 'No active note topics yet'}
              </div>
            )}
          </div>

          {/* Favorite Stars */}
          <div className="pt-4 border-t border-slate-200/65 dark:border-slate-800/60">
            <button
              onClick={() => setIsArchiveFolderOpen(prev => !prev)}
              className="w-full flex items-center justify-between p-2 rounded-xl bg-amber-50/50 dark:bg-slate-900/20 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 border border-amber-100/40 transition-all select-none cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Star size={15} className="text-amber-500" fill="currentColor" />
                <span className="text-[11px] font-black uppercase tracking-wider">Favorite Stars</span>
                <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
                  {archivedTopics.length}
                </span>
              </div>
              {isArchiveFolderOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {isArchiveFolderOpen && (
              <div className="mt-2 space-y-1.5 pl-1 animate-in fade-in slide-in-from-top-1 duration-200">
                {filteredArchivedTopics.length > 0 ? (
                  filteredArchivedTopics.map(t => renderTopic(t))
                ) : (
                  <div className="text-center py-4 text-[10px] text-slate-400 select-none">
                    {searchTerm ? 'No matching favorite topics' : 'Favorite Stars is empty'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Resizable drag handle (Touch + Mouse friendly) */}
        {isSidebarOpen && (
          <div
            className="absolute top-0 bottom-0 right-0 w-3 cursor-col-resize z-50 flex items-center justify-center group/resize-handle select-none touch-none touch-pan-y"
            onMouseDown={(e) => {
              e.preventDefault();
              isResizing.current = true;
              document.body.style.cursor = 'col-resize';
            }}
            onTouchStart={() => {
              isResizing.current = true;
            }}
          >
            {/* Visual handle indicator bar */}
            <div className="h-10 w-1 rounded-full bg-slate-350 dark:bg-slate-700 opacity-40 group-hover/resize-handle:opacity-100 group-active/resize-handle:opacity-100 group-hover/resize-handle:bg-orange-500 group-active/resize-handle:bg-orange-500 transition-all shadow-sm" />
          </div>
        )}
      </div>

      {/* Editor Area */}
      <div className={`flex-1 bg-transparent rounded-3xl p-4 md:p-6 border border-white/20 relative overflow-hidden flex flex-col ${!isSidebarOpen ? 'w-full' : 'hidden md:flex'}`}>
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-20 top-4 z-[100] p-3 bg-orange-500 text-white rounded-xl shadow-lg hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center"
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
                          const selection = window.getSelection();
                          if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                            const range = selection.getRangeAt(0);
                            const span = document.createElement('span');
                            span.style.fontFamily = font;
                            try {
                              span.appendChild(range.extractContents());
                              range.insertNode(span);
                              selection.removeAllRanges();
                              const newRange = document.createRange();
                              newRange.selectNodeContents(span);
                              selection.addRange(newRange);
                            } catch {
                              document.execCommand('styleWithCSS', false, 'true');
                              document.execCommand('fontName', false, font);
                            }
                            if (editorRef.current && selectedTopic) {
                              updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
                            }
                            const el = document.activeElement as HTMLElement;
                            el?.dispatchEvent(new Event('input', { bubbles: true }));
                          }
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
                          const selection = window.getSelection();
                          if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                            const range = selection.getRangeAt(0);
                            const span = document.createElement('span');
                            span.style.fontSize = `${size}px`;
                            try {
                              span.appendChild(range.extractContents());
                              range.insertNode(span);
                              selection.removeAllRanges();
                              const newRange = document.createRange();
                              newRange.selectNodeContents(span);
                              selection.addRange(newRange);
                            } catch {
                              document.execCommand('styleWithCSS', false, 'true');
                              document.execCommand('fontSize', false, '3');
                            }
                            if (editorRef.current && selectedTopic) {
                              updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
                            }
                            const el = document.activeElement as HTMLElement;
                            el?.dispatchEvent(new Event('input', { bubbles: true }));
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

                        {/* Table Tools Dropdown */}
                        <div className="relative z-[200]">
                          <button 
                            onClick={() => setShowTableToolsMenu(!showTableToolsMenu)}
                            className="flex items-center gap-1.5 px-2 py-1 bg-white/40 hover:bg-white text-slate-700 rounded-lg text-xs font-bold transition-all"
                            title="Table Tools"
                          >
                            <Grid3X3 size={14} className="text-orange-600" />
                            Table Tools
                            <ChevronDown size={12} className={`transition-transform duration-200 ${showTableToolsMenu ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {showTableToolsMenu && (
                            <div className="absolute right-0 top-full mt-2 z-[250] w-52 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2.5 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
                              {activeTableCell ? (
                                <>
                                  <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Word-Style Controls</div>
                                  <div className="grid grid-cols-2 gap-1 col-span-2">
                                    <button 
                                      onClick={() => { addRow('above'); setShowTableToolsMenu(false); }}
                                      className="flex items-center gap-1.5 p-1.5 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl transition-colors font-bold text-xs"
                                    >
                                      <ArrowUp size={12} className="text-orange-500" />
                                      Row Up
                                    </button>
                                    <button 
                                      onClick={() => { addRow('below'); setShowTableToolsMenu(false); }}
                                      className="flex items-center gap-1.5 p-1.5 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl transition-colors font-bold text-xs"
                                    >
                                      <ArrowDown size={12} className="text-orange-500" />
                                      Row Down
                                    </button>
                                    <button 
                                      onClick={() => { addColumn('left'); setShowTableToolsMenu(false); }}
                                      className="flex items-center gap-1.5 p-1.5 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl transition-colors font-bold text-xs"
                                    >
                                      <ArrowLeft size={12} className="text-orange-500" />
                                      Col Left
                                    </button>
                                    <button 
                                      onClick={() => { addColumn('right'); setShowTableToolsMenu(false); }}
                                      className="flex items-center gap-1.5 p-1.5 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl transition-colors font-bold text-xs"
                                    >
                                      <ArrowRight size={12} className="text-orange-500" />
                                      Col Right
                                    </button>
                                  </div>
                                  <div className="h-px bg-slate-100 my-0.5" />
                                  <div className="grid grid-cols-2 gap-1 col-span-2">
                                    <button 
                                      onClick={() => { deleteTableElement('row'); setShowTableToolsMenu(false); }}
                                      className="flex items-center gap-1.5 p-1.5 hover:bg-red-50 text-red-600 rounded-xl transition-colors font-bold text-xs"
                                    >
                                      <Trash2 size={12} className="text-red-500" />
                                      Del Row
                                    </button>
                                    <button 
                                      onClick={() => { deleteTableElement('col'); setShowTableToolsMenu(false); }}
                                      className="flex items-center gap-1.5 p-1.5 hover:bg-red-50 text-red-600 rounded-xl transition-colors font-bold text-xs"
                                    >
                                      <Trash2 size={12} className="text-red-500 rotate-90" />
                                      Del Col
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div className="p-3 text-center text-xs text-slate-500 font-bold leading-relaxed">
                                  <Grid3X3 size={20} className="mx-auto mb-2 text-slate-400" />
                                  💡 Click inside any table first to add/delete rows & columns!
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="h-6 w-px bg-white/30 mx-1" />

                    {/* Colors toolbar hidden for clean presentation */}
                    
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

                      {/* Table Tools Dropdown */}
                      <div className="relative z-[200]">
                        <button 
                          onClick={() => setShowTableToolsMenu(!showTableToolsMenu)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold shadow-sm transition-all font-sans"
                          title="Table Tools"
                        >
                          <Grid3X3 size={14} className="text-orange-600" />
                          Table Tools
                          <ChevronDown size={12} className={`transition-transform duration-200 ${showTableToolsMenu ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showTableToolsMenu && (
                          <div className="absolute right-0 top-full mt-2 z-[250] w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2.5 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
                            {activeTableCell ? (
                              <>
                                <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Word-Style Controls</div>
                                <div className="grid grid-cols-2 gap-1">
                                  <button 
                                    onClick={() => { addRow('above'); setShowTableToolsMenu(false); }}
                                    className="flex items-center gap-1.5 p-2 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl transition-colors font-bold text-xs"
                                    title="Insert Row Above"
                                  >
                                    <ArrowUp size={12} className="text-orange-500" />
                                    Row Above
                                  </button>
                                  <button 
                                    onClick={() => { addRow('below'); setShowTableToolsMenu(false); }}
                                    className="flex items-center gap-1.5 p-2 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl transition-colors font-bold text-xs"
                                    title="Insert Row Below"
                                  >
                                    <ArrowDown size={12} className="text-orange-500" />
                                    Row Below
                                  </button>
                                  <button 
                                    onClick={() => { addColumn('left'); setShowTableToolsMenu(false); }}
                                    className="flex items-center gap-1.5 p-2 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl transition-colors font-bold text-xs"
                                    title="Insert Column Left"
                                  >
                                    <ArrowLeft size={12} className="text-orange-500" />
                                    Col Left
                                  </button>
                                  <button 
                                    onClick={() => { addColumn('right'); setShowTableToolsMenu(false); }}
                                    className="flex items-center gap-1.5 p-2 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl transition-colors font-bold text-xs"
                                    title="Insert Column Right"
                                  >
                                    <ArrowRight size={12} className="text-orange-500" />
                                    Col Right
                                  </button>
                                </div>
                                <div className="h-px bg-slate-100 my-0.5" />
                                <div className="grid grid-cols-2 gap-1">
                                  <button 
                                    onClick={() => { deleteTableElement('row'); setShowTableToolsMenu(false); }}
                                    className="flex items-center gap-1.5 p-2 hover:bg-red-50 text-red-600 rounded-xl transition-colors font-bold text-xs"
                                    title="Delete Row"
                                  >
                                    <Trash2 size={12} className="text-red-500" />
                                    Delete Row
                                  </button>
                                  <button 
                                    onClick={() => { deleteTableElement('col'); setShowTableToolsMenu(false); }}
                                    className="flex items-center gap-1.5 p-2 hover:bg-red-50 text-red-600 rounded-xl transition-colors font-bold text-xs"
                                    title="Delete Column"
                                  >
                                    <Trash2 size={12} className="text-red-500 rotate-90" />
                                    Delete Col
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="p-3 text-center text-xs text-slate-500 font-bold leading-relaxed">
                                <Grid3X3 size={20} className="mx-auto mb-2 text-slate-400" />
                                💡 Click inside any table first to add/delete rows & columns!
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* MORE Tools Dropdown (Includes AI Enhance, Upload File, Synthesis Cards, Q&A Board) */}
                      <div className="relative z-[200]">
                        <button 
                          onClick={() => setShowMoreMenu(!showMoreMenu)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold shadow-sm transition-all font-sans"
                          title="More Actions & Layouts"
                        >
                          <MoreHorizontal size={14} />
                          More
                          <ChevronDown size={12} className={`transition-transform duration-200 ${showMoreMenu ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showMoreMenu && (
                          <div className="absolute right-0 bottom-full mb-2 z-[250] w-[220px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-150">
                            <div>
                              <div className="text-[10px] font-black uppercase text-indigo-400 tracking-wider mb-2 flex items-center gap-1.5">
                                <Wand2 size={12} className="text-indigo-500" />
                                AI Assist
                              </div>
                              <button 
                                onClick={() => { enhanceWithAI(); setShowMoreMenu(false); }} 
                                disabled={isAILoading}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-indigo-50 text-indigo-700 rounded-xl transition-all font-black text-[11px] uppercase tracking-wider"
                              >
                                {isAILoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                AI Enhance Note
                              </button>
                            </div>

                            <div className="h-px bg-slate-100" />

                            <div>
                              <div className="text-[10px] font-black uppercase text-blue-400 tracking-wider mb-2 flex items-center gap-1.5">
                                <FileUp size={12} className="text-blue-500" />
                                Media & Files
                              </div>
                              <button 
                                onClick={() => { fileInputRef.current?.click(); setShowMoreMenu(false); }} 
                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-50 text-blue-700 rounded-xl transition-all font-black text-[11px] uppercase tracking-wider"
                              >
                                <FileUp size={12} />
                                Upload File
                              </button>
                            </div>

                            <div className="h-px bg-slate-100" />

                            <div>
                              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                                <Layout size={12} className="text-slate-500" />
                                Insert Synthesis Card
                              </div>
                              <div className="grid grid-cols-5 gap-1.5">
                                {[
                                  { key: 'blue', color: 'bg-blue-500', border: 'border-blue-200', bg: 'bg-blue-50', name: 'Blue' },
                                  { key: 'emerald', color: 'bg-emerald-500', border: 'border-emerald-200', bg: 'bg-emerald-50', name: 'Emerald' },
                                  { key: 'rose', color: 'bg-rose-500', border: 'border-rose-200', bg: 'bg-rose-50', name: 'Rose' },
                                  { key: 'gold', color: 'bg-yellow-400', border: 'border-yellow-200', bg: 'bg-yellow-50', name: 'Gold' },
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
                                  { key: 'sky', color: 'bg-sky-500', border: 'border-sky-55', name: 'Sky' },
                                  { key: 'teal', color: 'bg-teal-500', border: 'border-teal-200', bg: 'bg-teal-50', name: 'Teal' },
                                  { key: 'orange', color: 'bg-orange-500', border: 'border-orange-200', bg: 'bg-orange-50', name: 'Orange' },
                                  { key: 'cyan', color: 'bg-cyan-500', border: 'border-cyan-200', bg: 'bg-cyan-50', name: 'Cyan' }
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
                  const editorTextColor = '#1e293b';
                  const editorHeaderColor = '#0f172a';
                  const editorBorderColor = '#cbd5e1';
                  const editorCardBgColor = '#f1f5f9';
                  
                  return (
                    <style dangerouslySetInnerHTML={{ __html: `
                      .editor-content {
                        color: ${editorTextColor};
                      }
                      
                      .editor-content p, 
                      .editor-content li, 
                      .editor-content div {
                        color: ${editorTextColor};
                      }
                      
                      .editor-content h1, 
                      .editor-content h2, 
                      .editor-content h3, 
                      .editor-content h4, 
                      .editor-content h5, 
                      .editor-content h6 {
                        color: ${editorHeaderColor} !important;
                        font-weight: 800 !important;
                      }
                      
                      .editor-content table {
                        border-collapse: collapse !important;
                        width: 100% !important;
                        border: ${tableBorderThickness + 0.5}px solid ${tableBorderColor};
                      }

                      .editor-content th, 
                      .editor-content td {
                        border: ${tableBorderThickness}px solid ${tableBorderColor};
                        padding: 12px 14px !important;
                        color: ${editorTextColor} !important;
                      }
                      
                      /* Lightbox styling to guarantee that custom templates (study plan, action plan) have a gorgeous light design on any background */
                      .editor-content .study-plan-card,
                      .editor-content .action-plan-card {
                        border: 2px solid ${editorBorderColor} !important;
                        background-color: ${editorCardBgColor} !important;
                        background: ${editorCardBgColor} !important;
                        color: ${editorTextColor} !important;
                        border-radius: 16px !important;
                        padding: 18px !important;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05) !important;
                      }

                      /* Synthesis Cards and QA Boards use the user-selected theme colors for their backgrounds, borders, and main layout natively! */
                      .editor-content .synthesis-card-wrapper, 
                      .editor-content .qa-board-wrapper {
                        border-radius: 20px !important;
                        padding: 20px !important;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03) !important;
                        margin: 18px 0 !important;
                      }

                      .editor-content .study-plan-card h1,
                      .editor-content .study-plan-card h2,
                      .editor-content .study-plan-card h3,
                      .editor-content .action-plan-card h1,
                      .editor-content .action-plan-card h2,
                      .editor-content .action-plan-card h3 {
                        color: ${editorHeaderColor} !important;
                      }

                      .editor-content .study-plan-card p, 
                      .editor-content .study-plan-card li, 
                      .editor-content .study-plan-card div,
                      .editor-content .action-plan-card p, 
                      .editor-content .action-plan-card li, 
                      .editor-content .action-plan-card div {
                        color: ${editorTextColor} !important;
                      }

                      /* Ensure unstyled spans inside template cards are readable, while preserving custom highlighted/colored texts */
                      .editor-content .study-plan-card span:not([style*="color"]):not([style*="background-color"]),
                      .editor-content .action-plan-card span:not([style*="color"]):not([style*="background-color"]) {
                        color: ${editorTextColor} !important;
                      }

                      /* Force elegant light design on template elements with dark classes or hardcoded dark background behaviors */
                      .editor-content [class*="bg-slate-9"],
                      .editor-content [class*="bg-zinc-9"],
                      .editor-content [class*="bg-gray-9"],
                      .editor-content [class*="bg-neutral-9"],
                      .editor-content [class*="bg-[#0f"],
                      .editor-content [class*="bg-[#1e"],
                      .editor-content [class*="bg-[#11"],
                      .editor-content [class*="bg-[#0a"],
                      .editor-content [class*="bg-[#18"],
                      .editor-content [class*="bg-[#1c"],
                      .editor-content [class*="bg-black"] {
                        background-color: ${editorCardBgColor} !important;
                        background: ${editorCardBgColor} !important;
                        border: 1.5px solid ${editorBorderColor} !important;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05) !important;
                      }

                      .editor-content [class*="bg-slate-9"] p,
                      .editor-content [class*="bg-slate-9"] div,
                      .editor-content [class*="bg-slate-9"] span:not([style*="color"]):not([style*="background-color"]),
                      .editor-content [class*="bg-zinc-9"] p,
                      .editor-content [class*="bg-[#1e"] p,
                      .editor-content [class*="bg-[#1e"] div,
                      .editor-content [class*="bg-[#1e"] span:not([style*="color"]):not([style*="background-color"]) {
                        color: ${editorTextColor} !important;
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
                    onKeyDown={handleEditorKeyDown}
                    onMouseMove={handleEditorMouseMove}
                    onMouseDown={handleEditorMouseDown}
                    onTouchStart={handleEditorTouchStart}
                    onBlur={(e) => {
                      updateTopic(selectedTopic.id, { content: e.currentTarget.innerHTML });
                    }}
                    style={{ 
                      textAlign: selectedTopic.alignment, 
                      minHeight: '300px',
                      fontSize: `${textFontSize}px`,
                      fontFamily: textFontFamily
                    }}
                    className={`editor-content w-full flex-1 outline-none p-8 rounded-3xl text-slate-800 leading-relaxed font-medium transition-all focus:ring-4 focus:ring-orange-500/10 overflow-y-auto shadow-md ${selectedPaper.className}`}
                ></div>

                {/* Table bottom tool container hidden because row/column manage buttons are between Export and Insert Date */}

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
                          <div className="flex gap-2 mb-4">
                             {['#f97316', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ffffff', '#64748b', '#f43f5e', '#d946ef', '#14b8a6', '#0ea5e9', '#84cc16', '#eab308', '#ec4899'].map(c => (
                               <button 
                                 key={c}
                                 onClick={() => setTableConfig({...tableConfig, theme: c})}
                                 className={`w-8 h-8 rounded-full border-2 transition-all ${tableConfig.theme === c ? 'border-orange-500 scale-125' : 'border-white'}`}
                                 style={{ backgroundColor: c }}
                               />
                             ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Table & Grid Lines Visibility/Opacity</label>
                          <div className="flex gap-2">
                             {[10, 25, 50, 75, 100].map(percentage => (
                               <button 
                                 key={percentage}
                                 onClick={() => setTableConfig({...tableConfig, gridOpacity: percentage})}
                                 className={`flex-1 py-2 rounded-xl border font-black text-[11px] uppercase tracking-wider transition-all ${tableConfig.gridOpacity === percentage ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/15' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                               >
                                 {percentage}%
                               </button>
                             ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 mt-4">Grid Line Style</label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: 'theme-solid', name: 'Whole Color', desc: 'Theme colors the whole table borders' },
                              { id: 'theme-open', name: 'Color + Blank Line', desc: 'Theme borders with open sides' },
                              { id: 'black-solid', name: 'Always Black', desc: 'Clear black borders for easy visibility' },
                              { id: 'black-open', name: 'Black + Blank Line', desc: 'Clear black borders with open sides' }
                            ].map(style => (
                              <button 
                                key={style.id}
                                type="button"
                                onClick={() => setTableConfig({...tableConfig, gridStyle: style.id})}
                                className={`p-3 rounded-2xl border text-left transition-all ${
                                  (tableConfig.gridStyle || 'theme-solid') === style.id 
                                    ? 'bg-orange-500/10 border-orange-500 text-slate-800' 
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <div className="text-[11px] font-black uppercase tracking-wide">
                                  {style.name}
                                </div>
                                <div className="text-[9px] font-bold text-slate-400 mt-0.5">
                                  {style.desc}
                                </div>
                              </button>
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

