-- Indexes to speed up timetable queries
CREATE INDEX IF NOT EXISTS trips_service_id_idx ON trips(service_id);
CREATE INDEX IF NOT EXISTS stop_times_stop_arrival_idx ON stop_times(stop_id, arrival_time);

-- RPC: get planned timetable for a stop on a given day
CREATE OR REPLACE FUNCTION stop_timetable(
  p_stop_id    text,
  p_day_name   text,
  p_route_id   text DEFAULT NULL,
  p_today      text DEFAULT NULL
)
RETURNS TABLE (
  arrival_time      text,
  route_id          text,
  route_short_name  text,
  trip_headsign     text,
  direction_id      smallint,
  trip_id           text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today text := COALESCE(p_today, to_char(NOW() AT TIME ZONE 'Europe/Brussels', 'YYYYMMDD'));
BEGIN
  RETURN QUERY
  SELECT
    st.arrival_time,
    r.route_id,
    r.route_short_name,
    t.trip_headsign,
    t.direction_id::smallint,
    t.trip_id
  FROM stop_times st
  JOIN trips t ON t.trip_id = st.trip_id
  JOIN calendar c ON c.service_id = t.service_id
  JOIN routes r ON r.route_id = t.route_id
  WHERE st.stop_id = p_stop_id
    AND c.start_date <= v_today
    AND c.end_date >= v_today
    AND (p_route_id IS NULL OR r.route_id = p_route_id)
    AND CASE p_day_name
      WHEN 'monday'    THEN c.monday
      WHEN 'tuesday'   THEN c.tuesday
      WHEN 'wednesday' THEN c.wednesday
      WHEN 'thursday'  THEN c.thursday
      WHEN 'friday'    THEN c.friday
      WHEN 'saturday'  THEN c.saturday
      WHEN 'sunday'    THEN c.sunday
      ELSE FALSE
    END
  ORDER BY st.arrival_time ASC;
END;
$$;
