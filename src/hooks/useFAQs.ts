import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FAQ {
  id: string;
  question: string;
  answer: string; // HTML content
  is_visible: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Hook to fetch all FAQs (for managers - includes hidden ones)
export const useFAQs = (includeHidden: boolean = false) => {
  return useQuery({
    queryKey: ['faqs', includeHidden],
    queryFn: async (): Promise<FAQ[]> => {
      let query = supabase
        .from('faqs')
        .select('*')
        .order('display_order', { ascending: true });

      if (!includeHidden) {
        query = query.eq('is_visible', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });
};

// Hook to create a new FAQ
export const useCreateFAQ = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (faqData: {
      question: string;
      answer: string;
      is_visible?: boolean;
      display_order?: number;
    }) => {
      const { data, error } = await supabase
        .from('faqs')
        .insert({
          question: faqData.question,
          answer: faqData.answer,
          is_visible: faqData.is_visible ?? true,
          display_order: faqData.display_order ?? 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs'] });
    },
  });
};

// Hook to update an FAQ
export const useUpdateFAQ = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<{
        question: string;
        answer: string;
        is_visible: boolean;
        display_order: number;
      }>;
    }) => {
      const { data, error } = await supabase
        .from('faqs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs'] });
    },
  });
};

// Hook to delete an FAQ
export const useDeleteFAQ = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('faqs').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs'] });
    },
  });
};

// Hook to reorder FAQs
export const useReorderFAQs = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reorderedFAQs: { id: string; display_order: number }[]) => {
      // Update all FAQs in a transaction-like manner
      const updates = reorderedFAQs.map((faq) =>
        supabase
          .from('faqs')
          .update({ display_order: faq.display_order })
          .eq('id', faq.id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter((result) => result.error);

      if (errors.length > 0) {
        throw errors[0].error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs'] });
    },
  });
};

