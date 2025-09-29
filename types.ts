
export interface Stop {
  id: string;
  order: number;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  tapa: string;
  photo: string;
  phone?: string;
  website?: string;
  notes?: string;
}

export interface RouteMeta {
  city: string;
  title: string;
  start: { name: string; lat: number; lng: number };
  end: { name: string; lat: number; lng: number };
}

export interface RouteData {
  meta: RouteMeta;
  stops: Stop[];
}

export type Progress = Record<string, boolean>;
