import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useServices } from './useServices';
import { useStations } from './useStations';
import { useTreatmentTypes } from './useTreatmentTypes';

export interface ServiceStationConfig {
  id: string;
  service_id: string;
  station_id: string;
  base_time_minutes: number;
  price_adjustment: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  remote_booking_allowed: boolean;
  requires_staff_approval: boolean;
}

export interface TreatmentTypeModifier {
  id: string;
  service_id: string;
  treatment_type_id: string;
  time_modifier_minutes: number;
  created_at: string;
}

export interface TreatmentTypeAdjustment {
  treatment_type_id: string;
  treatment_type_name: string;
  time_modifier_minutes: number;
}

export interface StationWithConfig {
  id: string;
  name: string;
  station_is_active: boolean;
  is_active: boolean;
  base_time_minutes: number;
  price_adjustment: number;
  remote_booking_allowed: boolean;
  requires_staff_approval: boolean;
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

export const useTreatmentTypeModifiers = (serviceId: string) => {
  return useQuery({
    queryKey: ['treatmentType-modifiers', serviceId],
    queryFn: async () => {
      // Join with treatmentTypes table to get treatmentType names
      const { data, error } = await supabase
        .from('treatmentType_modifiers')
        .select(`
          *,
          treatment_types!treatmentType_modifiers_treatment_type_id_fkey(
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
      priceAdjustment,
      isActive,
      remoteBookingAllowed,
      requiresStaffApproval
    }: { 
      serviceId: string; 
      stationId: string; 
      baseTimeMinutes?: number; 
      priceAdjustment?: number;
      isActive?: boolean;
      remoteBookingAllowed?: boolean;
      requiresStaffApproval?: boolean;
    }) => {
      // First check if record exists
      const { data: existing } = await supabase
        .from('service_station_matrix')
        .select('id')
        .eq('service_id', serviceId)
        .eq('station_id', stationId)
        .single();

      const updatePayload: Record<string, unknown> = {};
      if (baseTimeMinutes !== undefined) {
        updatePayload.base_time_minutes = baseTimeMinutes;
      }
      if (priceAdjustment !== undefined) {
        updatePayload.price_adjustment = priceAdjustment;
      }
      if (isActive !== undefined) {
        updatePayload.is_active = isActive;
      }
      if (remoteBookingAllowed !== undefined) {
        updatePayload.remote_booking_allowed = remoteBookingAllowed;
      }
      if (requiresStaffApproval !== undefined) {
        updatePayload.requires_staff_approval = requiresStaffApproval;
      }

      if (existing) {
        if (Object.keys(updatePayload).length === 0) {
          return existing;
        }

        const { data, error } = await supabase
          .from('service_station_matrix')
          .update(updatePayload)
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
            base_time_minutes: baseTimeMinutes ?? 60,
            price_adjustment: priceAdjustment ?? 0,
            is_active: isActive ?? true,
            remote_booking_allowed: remoteBookingAllowed ?? false,
            requires_staff_approval: requiresStaffApproval ?? false
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

export const useUpdateTreatmentTypeModifier = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      serviceId, 
      treatmentTypeId, 
      timeModifierMinutes 
    }: { 
      serviceId: string; 
      treatmentTypeId: string; 
      timeModifierMinutes: number 
    }) => {
      if (timeModifierMinutes === 0) {
        // Delete the modifier if it's 0
        const { error } = await supabase
          .from('treatmentType_modifiers')
          .delete()
          .eq('service_id', serviceId)
          .eq('treatment_type_id', treatmentTypeId);
        
        if (error) throw error;
        return null;
      } else {
        // Check if record exists
        const { data: existing } = await supabase
          .from('treatmentType_modifiers')
          .select('id')
          .eq('service_id', serviceId)
          .eq('treatment_type_id', treatmentTypeId)
          .single();

        if (existing) {
          // Update existing record
          const { data, error } = await supabase
            .from('treatmentType_modifiers')
            .update({
              time_modifier_minutes: timeModifierMinutes
            })
            .eq('service_id', serviceId)
            .eq('treatment_type_id', treatmentTypeId)
            .select()
            .single();
          
          if (error) throw error;
          return data;
        } else {
          // Insert new record
          const { data, error } = await supabase
            .from('treatmentType_modifiers')
            .insert({
              service_id: serviceId,
              treatment_type_id: treatmentTypeId,
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
      queryClient.invalidateQueries({ queryKey: ['treatmentType-modifiers', variables.serviceId] });
    }
  });
};

// Main composite hook that combines all the functionality
export const useServiceConfiguration = (serviceId: string) => {
  const { data: services } = useServices();
  const { data: allStations } = useStations();
  const { data: allTreatmentTypes } = useTreatmentTypes();
  const { data: stationConfigs } = useServiceStationConfigs(serviceId);
  const { data: treatmentTypeModifiersWithTreatmentTypes } = useTreatmentTypeModifiers(serviceId);
  const updateStationConfigMutation = useUpdateServiceStationConfig();
  const updateTreatmentTypeModifierMutation = useUpdateTreatmentTypeModifier();

  const service = services?.find(s => s.id === serviceId);

  // Combine stations with their configurations
  const stations: StationWithConfig[] = allStations?.map(station => {
    const config = stationConfigs?.find(c => c.station_id === station.id);
    return {
      id: station.id,
      name: station.name,
      station_is_active: station.is_active,
      is_active: config?.is_active ?? false,
      base_time_minutes: config?.base_time_minutes ?? 60,
      price_adjustment: config?.price_adjustment ?? 0,
      remote_booking_allowed: config?.remote_booking_allowed ?? false,
      requires_staff_approval: config?.requires_staff_approval ?? false,
    };
  }) || [];

  // Get treatmentType adjustments with proper names from the joined data
  const treatmentTypeAdjustments: TreatmentTypeAdjustment[] = treatmentTypeModifiersWithTreatmentTypes?.map(modifier => ({
    treatment_type_id: modifier.treatment_type_id,
    treatment_type_name: modifier.treatment_types?.name || 'גזע לא ידוע',
    time_modifier_minutes: modifier.time_modifier_minutes
  })) || [];

  const updateStationConfig = async (params: {
    serviceId: string;
    stationId: string;
    baseTimeMinutes?: number;
    priceAdjustment?: number;
    isActive?: boolean;
    remoteBookingAllowed?: boolean;
    requiresStaffApproval?: boolean;
  }) => {
    return updateStationConfigMutation.mutateAsync(params);
  };

  const addTreatmentTypeAdjustments = async (treatmentTypeIds: string[]) => {
    const promises = treatmentTypeIds.map(treatmentTypeId => 
      updateTreatmentTypeModifierMutation.mutateAsync({
        serviceId,
        treatmentTypeId,
        timeModifierMinutes: 15 // Default adjustment
      })
    );
    return Promise.all(promises);
  };

  const removeTreatmentTypeAdjustment = async (treatmentTypeId: string) => {
    return updateTreatmentTypeModifierMutation.mutateAsync({
      serviceId,
      treatmentTypeId,
      timeModifierMinutes: 0 // This will delete the record
    });
  };

  const updateTreatmentTypeTimeAdjustment = async (treatmentTypeId: string, timeModifierMinutes: number) => {
    return updateTreatmentTypeModifierMutation.mutateAsync({
      serviceId,
      treatmentTypeId,
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
    treatmentTypeAdjustments,
    isLoading: !services || !allStations,
    updateStationConfig,
    addTreatmentTypeAdjustments,
    removeTreatmentTypeAdjustment,
    updateTreatmentTypeTimeAdjustment,
    applyTimeToAllStations
  };
};
