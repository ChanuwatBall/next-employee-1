import axios from 'axios';

const api = axios.create({
  baseURL: 'https://nova-api.rubyclaw.tech/api',
});

/**
 * Fetches bus layout and seat availability for a specific trip.
 * @param tripId The unique identifier for the trip.
 * @returns An object containing tripId, layout, and seats array.
 */
const getErrorData = (err: any) => err?.response?.data ?? { error: err?.message ?? "Network error" }

const getSession = () => {
  const userstr = localStorage.getItem("session");
  return userstr ? JSON.parse(userstr) : null;
};

const getAuthHeaders = () => {
  const session = getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`
  };
};

export const getDriverTripPassengers = async (tripId: string) => {
  return await api.get(`/driver/trips/${tripId}/passengers`, {
    headers: getAuthHeaders()
  }).then((res: any) => {
    console.log("passengers res ", res)
    return res.data
  }).catch((err) => {
    console.log("err ", err.response.data)
    return err.response.data
  })
};

export const getTripSeats = async (tripId: string) => {
  const response = await api.get(`/trips/${tripId}/seats`);
  return response.data;
};

export interface Province {
  id: string;
  name: string;
  nameEn: string | null;
  routeIds: string[];
}

export const getProvinces = async (routeId?: string): Promise<Province[]> => {
  const response = await api.get("/provinces", {
    params: routeId ? { routeId } : undefined
  });
  return response.data || [];
};

const getProvinceName = (provinces: Province[], provinceId?: string) => {
  if (!provinceId) return undefined;
  return provinces.find((province) => province.id === provinceId)?.name;
};

const normalizeTripDetail = (trip: any, provinces: Province[] = []) => {
  if (!trip) return trip;

  const originProvinceId = trip.origin_province_id || trip.originProvinceId;
  const destinationProvinceId = trip.destination_province_id || trip.destinationProvinceId;
  const originName = getProvinceName(provinces, originProvinceId);
  const destinationName = getProvinceName(provinces, destinationProvinceId);

  const route = trip.route_id || trip.route || {
    id: trip.routeId,
    origin: originName || trip.origin || trip.originName || trip.originProvinceName || originProvinceId,
    destination: destinationName || trip.destination || trip.destinationName || trip.destinationProvinceName || destinationProvinceId,
    origin_id: originProvinceId,
    destination_id: destinationProvinceId,
    duration: trip.duration || ""
  };

  route.origin = originName || route.origin;
  route.destination = destinationName || route.destination;

  const busType = trip.bus_type || {
    id: trip.busTypeId || trip.bus_type_id || trip.busType,
    name: trip.busType || trip.busTypeName || "",
    amenities: trip.amenities || []
  };

  return {
    ...trip,
    route_id: route,
    bus_type: busType,
    bus_type_id: trip.bus_type_id || trip.busTypeId || busType.id,
    departure_time: trip.departure_time || trip.departureTime,
    arrival_time: trip.arrival_time || trip.arrivalTime,
    available_seats: trip.available_seats || trip.availableSeats,
    total_seats: trip.total_seats || trip.totalSeats,
    trip_type: trip.trip_type || trip.tripType,
    bus_number: trip.bus_number || trip.busNumber || trip.busPlate || "",
    origin_province_id: originProvinceId,
    destination_province_id: destinationProvinceId
  };
};

export const getTripDetail = async (id: string) => {
  const [tripResponse, provinces] = await Promise.all([
    api.get(`/trips/${id}`),
    getProvinces().catch((err) => {
      console.warn("Unable to load provinces", err);
      return [];
    })
  ]);

  return normalizeTripDetail(tripResponse.data, provinces);
};

export const getBookingDetail = async (id: string) => {
  // curl '/api/bookings/{id}' \
  // --header 'Authorization: Bearer YOUR_SECRET_TOKEN'
  const userstr = localStorage.getItem("session")
  const session = userstr ? JSON.parse(userstr) : null;
  const response = await api.get(`/bookings/${id}`, {
    headers: {
      Authorization: `Bearer ${session?.access_token}`
    }
  })
  return response.data;
}

export const getBusStops = async (routeId: string, 
  routeMeta?: { originProvinceId?: string; destinationProvinceId?: string; origin?: string; destination?: string }) => {
  return await api.get(`/bus-stops`, {
    params: { routeId }
  })
    .then((res) => {
      console.log("getBusStops res ", res)
      return (res.data || []).map((stop: any) => ({
        ...stop,
        order: stop.stopOrder,
        route_id: {
          id: stop.routeId,
          origin_id: routeMeta?.originProvinceId,
          destination_id: routeMeta?.destinationProvinceId,
          origin: routeMeta?.origin,
          destination: routeMeta?.destination,
        },
      }))
    })
    .catch((err) => {
      console.log("getBusStops err ", err)
      return getErrorData(err)
    })
}

export interface TripPassengerLocationItem {
  booking_id: string;
  booking_reference: string;
  passenger_name: string;
  seats: string[];
  latitude: number;
  longitude: number;
  accuracy_m: number;
  reported_at: string;
}

export interface TripPassengerLocationsResponse {
  trip_id: string;
  status: string;
  reason: string;
  shift_started_at: string;
  passengers: TripPassengerLocationItem[];
}

export const getTripPassengerLocations = async (tripId: string): Promise<TripPassengerLocationsResponse> => {
  const response = await api.get(`/trips/${tripId}/passenger-locations`, {
    headers: getAuthHeaders(),
  });

  return response.data;
};

export const checkInSelf = async (ticketNumber: string, qrCode: string) => {
  const response = await api.post(`/checkin/self`, {
    ticketNumber,
    qrCode
  }, {
    headers: getAuthHeaders()
  })
  return response.data;
}

export interface CreatePaymentQrPayload {
  amount: number;
}

export const createPaymentQr = async (payload: CreatePaymentQrPayload) => {
  const response = await api.post(`/payment/qr`, payload, {
    params: { amount: payload.amount },
    headers: {
      "Content-Type": "application/json"
    }
  });
  return response.data;
};

export interface CreateBookingPassengerPayload {
  seatId: string;
  seatNumber: string;
  fullName: string;
  thaiId: string;
  phone: string;
  passengerType: string;
}

export interface CreateBookingPayload {
  tripId: string;
  travelDate: string;
  originProvinceId: string;
  destinationProvinceId: string;
  boardingPointId: string;
  dropOffPointId: string;
  passengers: CreateBookingPassengerPayload[];
  promoCode: string;
  omiseChargeId: string;
}

export const createBooking = async (payload: CreateBookingPayload) => {
  const response = await api.post(`/bookings`, payload, {
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json"
    }
  });
  return response.data;
};

export const getPaymentTransaction = async (transactionId: string) => {
  const response = await api.get(`/payment/transaction/${transactionId}`);
  return response.data;
};

export const getDriverRounds = async (limit: number = 10, offset: number = 0) => {
  const response = await api.get(`/driver/rounds`, {
    params: { limit, offset },
    headers: getAuthHeaders()
  })
  console.log("getDriverRounds  ", response.data);
  return response.data;
}


export interface DriverLocationPayload {
  latitude: number;
  longitude: number;
  speed_kmh: number;
  heading_deg: number;
}

export const updateDriverLocation = async (payload: DriverLocationPayload) => {
  const response = await api.post(`/driver/location`, payload, {
    headers: getAuthHeaders()
  });
  return response.data;
};


export const startShift = async <T = unknown>(
  payload: any
) => {
  const response = await api.post("/driver/shift/start", payload, {
    headers: getAuthHeaders()
  }).then((res) => {
    console.log("startShift res ", res)
    return res.data
  }).catch((err) => {
    console.log("startShift err ", err.response.data)
    return err.response.data
  })

  return response;
};

export const stopShift = async (
  payload: any
) => {
  const response = await api.post("/driver/shift/stop", payload, {
    headers: getAuthHeaders()
  }).then((res) => {
    console.log("stopShift res ", JSON.stringify(res))
    return res.data
  }).catch((err) => {
    console.log("stopShift err ", JSON.stringify(err.response.data))
    return err.response.data
  })

  return response;
};

export interface CallCustomerPayload {
  booking_id?: string | null;
  call_time: string;
  user_id?: string | null;
  result: string;
  phone_number?: string | null;
  ticket_number?: string | null;
}

export const getCallCustomerHistory = async (params: {
  booking_id?: string | null;
  phone_number?: string | null;
  ticket_number?: string | null;
}) => {
  try {
    const response = await api.get("/driver/call-customer", {
      params,
      headers: getAuthHeaders()
    });
    return response.data || [];
  } catch (err: any) {
    if (err?.response?.status === 404) {
      console.warn("Nova API endpoint /driver/call-customer is not available yet.");
      return [];
    }
    throw err;
  }
};

export const saveCallCustomer = async (payload: CallCustomerPayload) => {
  try {
    const response = await api.post("/driver/call-customer", payload, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      console.warn("Nova API endpoint /driver/call-customer is not available yet.");
      return { skipped: true };
    }
    throw err;
  }
};


export default api;
