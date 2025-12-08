
import { PawPrint } from 'lucide-react';

const BreedAdjustmentGuidance = () => {
  return (
    <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200" dir="rtl">
      <div className="flex items-center space-x-3 space-x-reverse">
        <PawPrint className="w-5 h-5 text-blue-600" />
        <p className="text-blue-800 text-sm">
          רוצה לקבוע זמן או מחיר שונה לגזעים ספציפיים? התחל כאן!
        </p>
      </div>
    </div>
  );
};

export default BreedAdjustmentGuidance;
