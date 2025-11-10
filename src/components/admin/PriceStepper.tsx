
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';

interface PriceStepperProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
}

const PriceStepper = ({ 
  value, 
  onChange, 
  step = 5, 
  min = -100, 
  max = 500,
  disabled = false 
}: PriceStepperProps) => {
  const handleIncrement = () => {
    const newValue = Math.min(max, value + step);
    onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    onChange(newValue);
  };

  const formatValue = (val: number) => {
    if (val === 0) return '0₪';
    return val > 0 ? `+${val}₪` : `${val}₪`;
  };

  return (
    <div className="flex items-center space-x-2 space-x-reverse">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
      >
        <Minus className="w-4 h-4" />
      </Button>
      
      <div className="w-20 text-center">
        <span className={`font-bold text-sm ${
          value > 0 ? 'text-green-600' : 
          value < 0 ? 'text-red-600' : 'text-gray-600'
        }`}>
          {formatValue(value)}
        </span>
      </div>
      
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
      >
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default PriceStepper;
