
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Station {
  id: string;
  name: string;
  is_active: boolean;
  break_between_appointments: number;
  slot_interval_minutes: number;
  google_calendar_id?: string;
  created_at: string;
  updated_at: string;
}

export const useStations = () => {
  return useQuery({
    queryKey: ['stations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Station[];
    }
  });
};

export const useUpdateStation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Station> }) => {
      const { data, error } = await supabase
        .from('stations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stations'] });
      queryClient.invalidateQueries({ queryKey: ['services-with-stats'] });
    }
  });
};

export const useCreateStation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (stationData: { name: string; break_between_appointments?: number; slot_interval_minutes?: number }) => {
      const { data, error } = await supabase
        .from('stations')
        .insert({
          ...stationData,
          is_active: true,
          slot_interval_minutes: stationData.slot_interval_minutes ?? 60
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stations'] });
      queryClient.invalidateQueries({ queryKey: ['services-with-stats'] });
    }
  });
};

export const useDeleteStation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (stationId: string) => {
      const { error } = await supabase
        .from('stations')
        .delete()
        .eq('id', stationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stations'] });
      queryClient.invalidateQueries({ queryKey: ['services-with-stats'] });
    }
  });
};
