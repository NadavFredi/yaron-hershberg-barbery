
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X, Pencil } from 'lucide-react';

interface InlineEditNumberProps {
  value: number;
  onSave: (newValue: number) => Promise<void>;
  className?: string;
  suffix?: string;
  min?: number;
  max?: number;
}

const InlineEditNumber = ({ 
  value, 
  onSave, 
  className = "", 
  suffix = "",
  min,
  max
}: InlineEditNumberProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [isSaving, setIsSaving] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value.toString());
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditValue(value.toString());
  };

  const handleSave = async () => {
    const numValue = parseInt(editValue);
    
    if (isNaN(numValue) || numValue === value) {
      setIsEditing(false);
      setEditValue(value.toString());
      return;
    }

    if (min !== undefined && numValue < min) {
      setEditValue(min.toString());
      return;
    }

    if (max !== undefined && numValue > max) {
      setEditValue(max.toString());
      return;
    }

    setIsSaving(true);
    try {
      await onSave(numValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving:', error);
      setEditValue(value.toString());
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value.toString());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center space-x-2 space-x-reverse">
        <Input
          ref={inputRef}
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyPress}
          min={min}
          max={max}
          className="h-8 w-20"
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-green-600 hover:text-green-700"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Check className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-gray-500 hover:text-gray-700"
          onClick={handleCancel}
          disabled={isSaving}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center group cursor-pointer ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleStartEdit}
    >
      <span className="flex-1">{value} {suffix}</span>
      {isHovered && (
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 ml-2 opacity-50 group-hover:opacity-100 transition-opacity"
        >
          <Pencil className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
};

export default InlineEditNumber;
