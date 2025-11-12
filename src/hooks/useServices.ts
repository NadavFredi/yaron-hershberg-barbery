
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Service {
  id: string;
  name: string;
  description?: string;
  base_price: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceWithStats extends Service {
  averageTime: number;
  baseTime: number;
  configuredStationsCount: number;
  totalStationsCount: number;
  priceRange: {
    min: number;
    max: number;
  };
  stationConfigs: Array<{
    station_id: string;
    base_time_minutes: number;
    price_adjustment: number;
    is_active: boolean;
    remote_booking_allowed: boolean;
    requires_staff_approval: boolean;
    station_is_active: boolean;
  }>;
}

export const useServices = () => {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Service[];
    }
  });
};

export const useServicesWithStats = () => {
  return useQuery({
    queryKey: ['services-with-stats'],
    queryFn: async () => {
      // Get services with their station configurations
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          service_station_matrix(
            base_time_minutes,
            price_adjustment,
            station_id,
            is_active,
            remote_booking_allowed,
            requires_staff_approval,
            stations(is_active)
          )
        `)
        .order('name');
      
      if (servicesError) throw servicesError;

      // Get total active stations count
      const { count: totalStationsCount } = await supabase
        .from('stations')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const servicesWithStats: ServiceWithStats[] = servicesData.map(service => {
        type SupabaseStationConfig = {
          base_time_minutes: number;
          price_adjustment: number;
          station_id: string;
          is_active?: boolean;
          remote_booking_allowed?: boolean;
          requires_staff_approval?: boolean;
          stations?: {
            is_active: boolean | null;
          };
        };

        const configs = (service.service_station_matrix || []) as SupabaseStationConfig[];
        const stationConfigs = configs.map((config) => ({
          station_id: config.station_id,
          base_time_minutes: config.base_time_minutes,
          price_adjustment: config.price_adjustment,
          is_active: config.is_active ?? true,
          remote_booking_allowed: config.remote_booking_allowed ?? false,
          requires_staff_approval: config.requires_staff_approval ?? false,
          station_is_active: config.stations?.is_active ?? false,
        }));
        const activeConfigs = stationConfigs.filter(config => config.is_active && config.station_is_active);
        
        const averageTime = activeConfigs.length > 0 
          ? Math.round(activeConfigs.reduce((sum, config) => sum + config.base_time_minutes, 0) / activeConfigs.length)
          : 0;

        const baseTime = (() => {
          if (activeConfigs.length > 0) {
            return Math.min(...activeConfigs.map((config) => config.base_time_minutes))
          }
          if (stationConfigs.length > 0) {
            return stationConfigs[0].base_time_minutes
          }
          return 0
        })();

        // Calculate price range based on base_price + price_adjustment
        const finalPrices = activeConfigs.map(config => 
          service.base_price + (config.price_adjustment || 0)
        );
        
        const priceRange = finalPrices.length > 0 
          ? {
              min: Math.min(...finalPrices),
              max: Math.max(...finalPrices)
            }
          : { min: service.base_price, max: service.base_price };

        return {
          id: service.id,
          name: service.name,
          description: service.description,
          base_price: service.base_price,
          created_at: service.created_at,
          updated_at: service.updated_at,
          averageTime,
          baseTime,
          configuredStationsCount: activeConfigs.length,
          totalStationsCount: totalStationsCount || 0,
          priceRange,
          stationConfigs,
        };
      });

      return servicesWithStats;
    }
  });
};

export const useCreateService = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (serviceData: { name: string; description?: string; base_price: number }) => {
      const { data, error } = await supabase
        .from('services')
        .insert(serviceData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['services-with-stats'] });
    }
  });
};

export const useUpdateService = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      serviceId, 
      name, 
      description, 
      base_price 
    }: { 
      serviceId: string; 
      name?: string; 
      description?: string; 
      base_price?: number;
    }) => {
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (base_price !== undefined) updateData.base_price = base_price;

      const { data, error } = await supabase
        .from('services')
        .update(updateData)
        .eq('id', serviceId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['services-with-stats'] });
    }
  });
};
