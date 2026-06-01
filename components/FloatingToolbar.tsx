import React, { useRef, useEffect, useState } from 'react';
import { Palette, Bold, Italic, Underline as UnderlineIcon, Strikethrough, CheckSquare, Type } from 'lucide-react';

export const fontFamilies = [
    { name: 'Modern', value: 'Inter' },
    { name: 'Display', value: 'Space Grotesk' },
    { name: 'Elegant', value: 'Playfair Display' },
    { name: 'Technical', value: 'JetBrains Mono' },
    { name: 'Handwritten', value: 'cursive' }
];

export const textColors = [
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

export const FloatingToolbar = () => {
    const [pickerPos, setPickerPos] = useState<{ x: number, y: number } | null>(null);
    const savedRange = useRef<Range | null>(null);

    useEffect(() => {
        const handleSelection = () => {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            // Only show if the selection is inside a contenteditable
            let isEditable = false;
            let node = range.commonAncestorContainer;
            while (node) {
              if (node.nodeType === 1 && (node as HTMLElement).getAttribute('contenteditable') === 'true') {
                isEditable = true;
                break;
              }
              node = node.parentNode as Node;
            }

            if (isEditable && rect.width > 0) {
              setPickerPos({
                x: rect.left + (rect.width / 2),
                y: rect.top - 10
              });
              savedRange.current = range.cloneRange();
            } else {
              setPickerPos(null);
            }
          } else {
            setPickerPos(null);
          }
        };

        const handleMouseUp = () => setTimeout(handleSelection, 10);
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift' || e.key.startsWith('Arrow')) {
                setTimeout(handleSelection, 10);
            }
        };

        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('keyup', handleKeyUp);
        
        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const applyTextColor = (color: string) => {
        const selection = window.getSelection();
        if (!selection || !savedRange.current) return;
        
        selection.removeAllRanges();
        selection.addRange(savedRange.current);

        if (color === 'transparent') {
            document.execCommand('removeFormat', false, undefined);
        } else {
            document.execCommand('foreColor', false, color);
        }

        selection.removeAllRanges();
        savedRange.current = null;
        setPickerPos(null);
    };

    const applyFormat = (command: string, value?: string) => {
        const selection = window.getSelection();
        if (!selection || !savedRange.current) return;
        
        selection.removeAllRanges();
        selection.addRange(savedRange.current);

        document.execCommand(command, false, value);

        // Keep selection active to allow combining formats
        savedRange.current = selection.getRangeAt(0).cloneRange();
    };

    const insertChecklist = () => {
        const selection = window.getSelection();
        if (!selection || !savedRange.current) return;
        
        selection.removeAllRanges();
        selection.addRange(savedRange.current);

        const html = `<ul style="list-style-type: none; padding-left: 0; margin-top: 4px; margin-bottom: 4px;"><li style="display: flex; gap: 8px; align-items: flex-start;"><span contenteditable="false" class="task-checkbox" style="cursor: pointer; user-select: none;">⬜</span><span>&nbsp;</span></li></ul><div><br></div>`;
        document.execCommand('insertHTML', false, html);
        
        savedRange.current = null;
        setPickerPos(null);
    };

    if (!pickerPos) return null;

    return (
        <div 
            className="fixed z-[9999] bg-white p-3 rounded-[24px] shadow-[0px_20px_50px_rgba(0,0,0,0.15)] border border-slate-200 flex flex-col gap-3 animate-in fade-in zoom-in slide-in-from-bottom-2 duration-200 min-w-[360px]"
            style={{ left: pickerPos.x, top: pickerPos.y, transform: 'translateX(-50%) translateY(-110%)' }}
            onMouseDown={(e) => e.preventDefault()}
        >
            <div className="flex gap-2 items-center px-1">
                <div className="flex bg-slate-50 p-1 rounded-xl gap-1 items-center shrink-0">
                    <select 
                        onChange={(e) => {
                            const font = e.target.value;
                            applyFormat('fontName', font);
                        }}
                        className="bg-white px-2 py-1 rounded-lg text-[10px] font-bold border-none outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                        title="Font"
                    >
                        {fontFamilies.map(f => (
                            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.name}</option>
                        ))}
                    </select>
                    
                    <select 
                        onChange={(e) => {
                            const size = e.target.value;
                            const selection = window.getSelection();
                            if (selection && selection.rangeCount > 0) {
                                const range = selection.getRangeAt(0);
                                const span = document.createElement('span');
                                span.style.fontSize = `${size}px`;
                                try {
                                    range.surroundContents(span);
                                } catch {
                                    // Fallback if range is complex
                                    document.execCommand('fontSize', false, '3'); // Medium
                                }
                            }
                        }}
                        className="bg-white px-2 py-1 rounded-lg text-[10px] font-bold border-none outline-none cursor-pointer hover:bg-slate-100 transition-colors w-14"
                        title="Size"
                    >
                        {[12, 14, 16, 18, 20, 24, 28, 32, 48].map(s => (
                            <option key={s} value={s}>{s}px</option>
                        ))}
                    </select>
                </div>

                <div className="w-px h-6 bg-slate-100 self-center mx-1" />

                <div className="flex gap-1">
                    <button onClick={() => applyFormat('bold')} className="p-2 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors" title="Bold"><Bold size={16} /></button>
                    <button onClick={() => applyFormat('italic')} className="p-2 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors" title="Italic"><Italic size={16} /></button>
                    <button onClick={() => applyFormat('underline')} className="p-2 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors" title="Underline"><UnderlineIcon size={18} /></button>
                    <button onClick={() => applyFormat('strikeThrough')} className="p-2 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors" title="Strikethrough"><Strikethrough size={18} /></button>
                </div>

                <div className="w-px h-6 bg-slate-100 self-center mx-2" />

                <button
                    onClick={insertChecklist}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all font-black text-[10px] uppercase tracking-wider border border-emerald-100"
                >
                    <CheckSquare size={16} /> CHECKLIST
                </button>
            </div>

            <div className="w-full h-px bg-slate-100" />

            <div className="flex flex-col gap-3 px-1 pb-1">
                <div className="flex gap-3 items-center">
                    <Palette size={14} className="text-slate-300" />
                    <div className="flex gap-1.5 ml-4">
                    {textColors.slice(0, 10).map(color => (
                        <button 
                            key={color.value}
                            className={`w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-125 transition-transform ${color.value === 'transparent' ? 'bg-slate-50 flex items-center justify-center' : ''}`}
                            style={{ backgroundColor: color.value === 'transparent' ? '' : color.value }}
                            onClick={() => applyTextColor(color.value)}
                            title={color.name}
                        >
                            {color.value === 'transparent' && <span className="text-[10px] font-black opacity-30">✕</span>}
                        </button>
                    ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const RichTextDiv: React.FC<{
    value: string;
    onChange: (val: string) => void;
    className?: string;
    style?: React.CSSProperties;
    placeholder?: string;
    tagName?: string;
    onFocus?: () => void;
    onBlur?: () => void;
}> = ({ value, onChange, className, style, placeholder, tagName = 'div', onFocus, onBlur }) => {
    const editorRef = useRef<HTMLElement>(null);
    const isFocusedRef = useRef(false);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedValueRef = useRef(value);

    // Only update innerHTML if not focused & content differs (prevents caret jump for typing user)
    useEffect(() => {
        if (editorRef.current && !isFocusedRef.current && editorRef.current.innerHTML !== (value || '')) {
            editorRef.current.innerHTML = value || '';
            lastSavedValueRef.current = value || '';
        }
    }, [value]);

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const handleInput = (e: React.FormEvent<HTMLElement>) => {
        const newValue = e.currentTarget.innerHTML;
        
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            if (newValue !== lastSavedValueRef.current) {
                lastSavedValueRef.current = newValue;
                onChange(newValue);
            }
        }, 1200); // 1.2 second debounce keeps high frequency typing buttery smooth
    };

    const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
        isFocusedRef.current = false;
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        const newValue = e.target.innerHTML;
        if (newValue !== lastSavedValueRef.current) {
            lastSavedValueRef.current = newValue;
            onChange(newValue);
        }
        if (onBlur) onBlur();
    };

    const handleFocus = () => {
        isFocusedRef.current = true;
        if (onFocus) onFocus();
    };

    const handleClick = (e: React.MouseEvent<HTMLElement>) => {
        const target = e.target as HTMLElement;
        if (target.classList?.contains('task-checkbox') && target.getAttribute('contenteditable') === 'false') {
            const text = target.innerText.trim();
            const toggles: Record<string, string> = {
                '⬜': '✅', '✅': '⬜',
                '[ ]': '[x]', '[x]': '[ ]',
                '🔳': '✅',
                '⚪': '🟢', '🟢': '⚪',
                '🔴': '🟢',
                '❎': '✅',
                '✓': '✅'
            };
            if (toggles[text]) {
                target.innerText = toggles[text];
                if (editorRef.current) {
                    const newValue = editorRef.current.innerHTML;
                    lastSavedValueRef.current = newValue;
                    onChange(newValue);
                }
            }
        }
    };

    const Tag = tagName as any;

    return (
        <Tag
            ref={editorRef}
            contentEditable={true}
            suppressContentEditableWarning={true}
            className={`outline-none empty:before:content-[attr(placeholder)] empty:before:text-black/30 ${className || ''}`}
            style={style}
            onInput={handleInput}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onClick={handleClick}
            placeholder={placeholder}
        />
    );
};
