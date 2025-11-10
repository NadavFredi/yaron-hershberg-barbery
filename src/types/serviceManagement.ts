
export interface ServiceStationConfig {
  serviceId: string;
  stationId: string;
  baseTimeMinutes: number;
  price: number;
}

export interface ServiceBreedModifier {
  serviceId: string;
  breedId: string;
  timeModifierMinutes: number;
}

export interface ServiceWithStats {
  id: string;
  name: string;
  description?: string;
  averageTime: number;
  configuredStationsCount: number;
  totalStationsCount: number;
}
