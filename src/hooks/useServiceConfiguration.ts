import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useServices } from './useServices';
import { useStations } from './useStations';
import { useBreeds } from './useBreeds';

export interface ServiceStationConfig {
  id: string;
  service_id: string;
  station_id: string;
  base_time_minutes: number;
  price_adjustment: number;
  created_at: string;
}

export interface BreedModifier {
  id: string;
  service_id: string;
  breed_id: string;
  time_modifier_minutes: number;
  created_at: string;
}

export interface BreedAdjustment {
  breed_id: string;
  breed_name: string;
  time_modifier_minutes: number;
}

export interface StationWithConfig {
  id: string;
  name: string;
  is_active: boolean;
  base_time_minutes: number;
  price_adjustment: number;
}

export const useServiceStationConfigs = (serviceId: string) => {
  return useQuery({
    queryKey: ['service-station-configs', serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_station_matrix')
        .select('*')
        .eq('service_id', serviceId);
      
      if (error) throw error;
      return data as ServiceStationConfig[];
    }
  });
};

export const useBreedModifiers = (serviceId: string) => {
  return useQuery({
    queryKey: ['breed-modifiers', serviceId],
    queryFn: async () => {
      // Join with breeds table to get breed names
      const { data, error } = await supabase
        .from('breed_modifiers')
        .select(`
          *,
          breeds!breed_modifiers_breed_id_fkey(
            id,
            name
          )
        `)
        .eq('service_id', serviceId);
      
      if (error) throw error;
      return data;
    }
  });
};

export const useUpdateServiceStationConfig = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      serviceId, 
      stationId, 
      baseTimeMinutes, 
      priceAdjustment 
    }: { 
      serviceId: string; 
      stationId: string; 
      baseTimeMinutes: number; 
      priceAdjustment?: number 
    }) => {
      // First check if record exists
      const { data: existing } = await supabase
        .from('service_station_matrix')
        .select('id')
        .eq('service_id', serviceId)
        .eq('station_id', stationId)
        .single();

      if (existing) {
        // Update existing record
        const { data, error } = await supabase
          .from('service_station_matrix')
          .update({
            base_time_minutes: baseTimeMinutes,
            price_adjustment: priceAdjustment || 0
          })
          .eq('service_id', serviceId)
          .eq('station_id', stationId)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Insert new record
        const { data, error } = await supabase
          .from('service_station_matrix')
          .insert({
            service_id: serviceId,
            station_id: stationId,
            base_time_minutes: baseTimeMinutes,
            price_adjustment: priceAdjustment || 0
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['service-station-configs', variables.serviceId] });
      queryClient.invalidateQueries({ queryKey: ['services-with-stats'] });
    }
  });
};

export const useDeleteServiceStationConfig = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ serviceId, stationId }: { serviceId: string; stationId: string }) => {
      const { error } = await supabase
        .from('service_station_matrix')
        .delete()
        .eq('service_id', serviceId)
        .eq('station_id', stationId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['service-station-configs', variables.serviceId] });
      queryClient.invalidateQueries({ queryKey: ['services-with-stats'] });
    }
  });
};

export const useUpdateBreedModifier = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      serviceId, 
      breedId, 
      timeModifierMinutes 
    }: { 
      serviceId: string; 
      breedId: string; 
      timeModifierMinutes: number 
    }) => {
      if (timeModifierMinutes === 0) {
        // Delete the modifier if it's 0
        const { error } = await supabase
          .from('breed_modifiers')
          .delete()
          .eq('service_id', serviceId)
          .eq('breed_id', breedId);
        
        if (error) throw error;
        return null;
      } else {
        // Check if record exists
        const { data: existing } = await supabase
          .from('breed_modifiers')
          .select('id')
          .eq('service_id', serviceId)
          .eq('breed_id', breedId)
          .single();

        if (existing) {
          // Update existing record
          const { data, error } = await supabase
            .from('breed_modifiers')
            .update({
              time_modifier_minutes: timeModifierMinutes
            })
            .eq('service_id', serviceId)
            .eq('breed_id', breedId)
            .select()
            .single();
          
          if (error) throw error;
          return data;
        } else {
          // Insert new record
          const { data, error } = await supabase
            .from('breed_modifiers')
            .insert({
              service_id: serviceId,
              breed_id: breedId,
              time_modifier_minutes: timeModifierMinutes
            })
            .select()
            .single();
          
          if (error) throw error;
          return data;
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['breed-modifiers', variables.serviceId] });
    }
  });
};

// Main composite hook that combines all the functionality
export const useServiceConfiguration = (serviceId: string) => {
  const { data: services } = useServices();
  const { data: allStations } = useStations();
  const { data: allBreeds } = useBreeds();
  const { data: stationConfigs } = useServiceStationConfigs(serviceId);
  const { data: breedModifiersWithBreeds } = useBreedModifiers(serviceId);
  const updateStationConfigMutation = useUpdateServiceStationConfig();
  const updateBreedModifierMutation = useUpdateBreedModifier();

  const service = services?.find(s => s.id === serviceId);

  // Combine stations with their configurations
  const stations: StationWithConfig[] = allStations?.map(station => {
    const config = stationConfigs?.find(c => c.station_id === station.id);
    return {
      id: station.id,
      name: station.name,
      is_active: station.is_active,
      base_time_minutes: config?.base_time_minutes || 60,
      price_adjustment: config?.price_adjustment || 0
    };
  }) || [];

  // Get breed adjustments with proper names from the joined data
  const breedAdjustments: BreedAdjustment[] = breedModifiersWithBreeds?.map(modifier => ({
    breed_id: modifier.breed_id,
    breed_name: modifier.breeds?.name || 'גזע לא ידוע',
    time_modifier_minutes: modifier.time_modifier_minutes
  })) || [];

  const updateStationConfig = async (params: {
    serviceId: string;
    stationId: string;
    baseTimeMinutes: number;
    priceAdjustment?: number;
  }) => {
    return updateStationConfigMutation.mutateAsync(params);
  };

  const addBreedAdjustments = async (breedIds: string[]) => {
    const promises = breedIds.map(breedId => 
      updateBreedModifierMutation.mutateAsync({
        serviceId,
        breedId,
        timeModifierMinutes: 15 // Default adjustment
      })
    );
    return Promise.all(promises);
  };

  const removeBreedAdjustment = async (breedId: string) => {
    return updateBreedModifierMutation.mutateAsync({
      serviceId,
      breedId,
      timeModifierMinutes: 0 // This will delete the record
    });
  };

  const updateBreedTimeAdjustment = async (breedId: string, timeModifierMinutes: number) => {
    return updateBreedModifierMutation.mutateAsync({
      serviceId,
      breedId,
      timeModifierMinutes
    });
  };

  const applyTimeToAllStations = async (timeMinutes: number) => {
    const promises = stations.map(station => 
      updateStationConfigMutation.mutateAsync({
        serviceId,
        stationId: station.id,
        baseTimeMinutes: timeMinutes,
        priceAdjustment: station.price_adjustment
      })
    );
    return Promise.all(promises);
  };

  return {
    service,
    stations,
    breedAdjustments,
    isLoading: !services || !allStations,
    updateStationConfig,
    addBreedAdjustments,
    removeBreedAdjustment,
    updateBreedTimeAdjustment,
    applyTimeToAllStations
  };
};
