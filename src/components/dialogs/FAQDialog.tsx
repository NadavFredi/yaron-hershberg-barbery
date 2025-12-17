import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { FAQ } from '@/hooks/useFAQs';

interface FAQDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'add' | 'edit';
    faq?: FAQ | null;
    onSave: (data: { question: string; answer: string; is_visible: boolean }) => Promise<void>;
    isPending?: boolean;
    trigger?: React.ReactNode;
}

export function FAQDialog({
    open,
    onOpenChange,
    mode,
    faq,
    onSave,
    isPending = false,
    trigger,
}: FAQDialogProps) {
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [isVisible, setIsVisible] = useState(true);

    // Reset form when dialog opens/closes or faq changes
    useEffect(() => {
        if (open) {
            if (mode === 'edit' && faq) {
                setQuestion(faq.question);
                setAnswer(faq.answer);
                setIsVisible(faq.is_visible);
            } else {
                setQuestion('');
                setAnswer('');
                setIsVisible(true);
            }
        }
    }, [open, mode, faq]);

    const handleSave = async () => {
        if (!question.trim() || !answer.trim()) {
            return;
        }

        await onSave({
            question: question.trim(),
            answer: answer,
            is_visible: isVisible,
        });
    };

    const handleClose = () => {
        onOpenChange(false);
    };

    const title = mode === 'add' ? 'הוסף שאלה חדשה' : 'ערוך שאלה';
    const saveButtonText = mode === 'add' ? 'שמור' : 'שמור שינויים';

    const dialogContent = (
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
                <DialogTitle className="text-right">{title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
                <div>
                    <Label htmlFor="question">שאלה</Label>
                    <Input
                        id="question"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="הכנס שאלה..."
                        className="mt-1"
                    />
                </div>
                <div>
                    <Label htmlFor="answer">תשובה</Label>
                    <div className="mt-1">
                        <RichTextEditor
                            value={answer}
                            onChange={setAnswer}
                            placeholder="הכנס תשובה כאן... ניתן לערוך עיצוב, צבעים, גודל גופן וכו'"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="is-visible"
                        checked={isVisible}
                        onCheckedChange={(checked) => setIsVisible(checked === true)}
                    />
                    <Label htmlFor="is-visible" className="cursor-pointer">
                        גלוי למשתמשים
                    </Label>
                </div>
            </div>
            <DialogFooter className="sm:justify-start gap-2">
                <Button variant="outline" onClick={handleClose} disabled={isPending}>
                    ביטול
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={isPending || !question.trim() || !answer.trim()}
                >
                    {isPending ? (
                        <>
                            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                            שומר...
                        </>
                    ) : (
                        saveButtonText
                    )}
                </Button>
            </DialogFooter>
        </DialogContent>
    );

    if (trigger) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogTrigger asChild>
                    {trigger}
                </DialogTrigger>
                {dialogContent}
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {dialogContent}
        </Dialog>
    );
}

