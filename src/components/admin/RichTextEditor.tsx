import React, { useMemo, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'הכנס תשובה כאן...',
  className,
}) => {
  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          ['bold', 'underline', 'strike'],
        ],
      },
    }),
    []
  );

  const formats = [
    'bold',
    'underline',
    'strike',
  ];

  useEffect(() => {
    // Add RTL styles for Quill editor
    const style = document.createElement('style');
    style.textContent = `
      .rich-text-editor .ql-container {
        font-family: inherit;
        font-size: 16px;
        direction: rtl;
      }
      .rich-text-editor .ql-editor {
        min-height: 200px;
        direction: rtl;
        text-align: right;
      }
      .rich-text-editor .ql-toolbar {
        direction: rtl;
        border-top-right-radius: 0.5rem;
        border-top-left-radius: 0.5rem;
      }
      .rich-text-editor .ql-container {
        border-bottom-right-radius: 0.5rem;
        border-bottom-left-radius: 0.5rem;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className={cn('rich-text-editor', className)} dir="rtl">
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        style={{ minHeight: '200px' }}
      />
    </div>
  );
};

