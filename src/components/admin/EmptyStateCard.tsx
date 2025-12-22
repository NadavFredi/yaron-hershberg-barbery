
import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface EmptyStateCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  variant?: 'default' | 'dashed';
}

const EmptyStateCard = ({ 
  icon, 
  title, 
  description, 
  actionLabel, 
  onAction,
  variant = 'dashed'
}: EmptyStateCardProps) => {
  return (
    <Card className={`
      ${variant === 'dashed' ? 'border-dashed border-2 border-gray-300' : 'border-gray-200'}
      bg-gray-50/50 hover:bg-gray-50 transition-colors
    `}>
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
        <div className="text-gray-400 text-4xl">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-gray-600 max-w-md">{description}</p>
        </div>
        <Button 
          onClick={onAction}
          className="bg-primary hover:bg-primary/90 text-white px-6 py-2 animate-pulse"
        >
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
};

export default EmptyStateCard;
