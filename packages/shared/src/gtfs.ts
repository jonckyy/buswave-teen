// ── GTFS Static Types ──────────────────────────────────────────────────────

export interface GtfsRoute {
  route_id: string
  agency_id: string
  route_short_name: string
  route_long_name: string
  route_type: number
  route_color?: string
  route_text_color?: string
}

export interface GtfsStop {
  stop_id: string
  stop_name: string
  stop_lat: number
  stop_lon: number
  stop_code?: string
  location_type?: number
  parent_station?: string
}

export interface GtfsTrip {
  trip_id: string
  route_id: string
  service_id: string
  trip_headsign?: string
  direction_id?: 0 | 1
  shape_id?: string
}

export interface GtfsStopTime {
  trip_id: string
  stop_id: string
  stop_sequence: number
  arrival_time: string
  departure_time: string
  shape_dist_traveled?: number
}

export interface GtfsShape {
  shape_id: string
  shape_pt_lat: number
  shape_pt_lon: number
  shape_pt_sequence: number
  shape_dist_traveled?: number
}

export interface RouteDirection {
  directionId: 0 | 1
  headsign: string
  stops: GtfsStop[]
}

export interface GtfsCalendar {
  service_id: string
  monday: boolean
  tuesday: boolean
  wednesday: boolean
  thursday: boolean
  friday: boolean
  saturday: boolean
  sunday: boolean
  start_date: string
  end_date: string
}
