import { CapacitorHttp, HttpHeaders, HttpParams } from '@capacitor/core';

export const API = 'https://nova-api.rubyclaw.tech/api';

const DEFAULT_HEADERS: HttpHeaders = {
	'Content-Type': 'application/json',
};

const getErrorData = (err: any) => err?.response?.data ?? { error: err?.message ?? 'Network error' };

const getErrorStatus = (err: any) => err?.response?.status ?? err?.status;

const getSession = () => {
	try {
		const userStr = localStorage.getItem('session');
		return userStr ? JSON.parse(userStr) : null;
	} catch {
		return null;
	}
};

const getAuthHeaders = (): HttpHeaders => {
	const session = getSession();
	if (!session?.access_token) return {};
	return { Authorization: `Bearer ${session.access_token}` };
};

const toHttpParams = (params: Record<string, unknown>): HttpParams => {
	const normalized: HttpParams = {};
	Object.entries(params).forEach(([key, value]) => {
		if (value === undefined || value === null) return;
		if (Array.isArray(value)) {
			normalized[key] = value.map((item) => String(item));
			return;
		}
		normalized[key] = String(value);
	});
	return normalized;
};

const toAbsoluteUrl = (path: string) => (path.startsWith('http') ? path : `${API}${path}`);

const requestData = async <T = any>(
	method: string,
	path: string,
	options?: {
		params?: HttpParams;
		headers?: HttpHeaders;
		data?: any;
	},
): Promise<T> => {
	const response = await CapacitorHttp.request({
		method,
		url: toAbsoluteUrl(path),
		params: options?.params,
		headers: { ...DEFAULT_HEADERS, ...(options?.headers ?? {}) },
		data: options?.data,
	});

	return response.data as T;
};

export const apiClient = {
	request: <T = any>(
		method: string,
		path: string,
		options?: { params?: HttpParams; headers?: HttpHeaders; data?: any },
	) => requestData<T>(method, path, options),
	get: <T = any>(path: string, options?: { params?: HttpParams; headers?: HttpHeaders }) =>
		requestData<T>('GET', path, options),
	post: <T = any>(path: string, data?: any, options?: { params?: HttpParams; headers?: HttpHeaders }) =>
		requestData<T>('POST', path, { ...options, data }),
	put: <T = any>(path: string, data?: any, options?: { params?: HttpParams; headers?: HttpHeaders }) =>
		requestData<T>('PUT', path, { ...options, data }),
	patch: <T = any>(path: string, data?: any, options?: { params?: HttpParams; headers?: HttpHeaders }) =>
		requestData<T>('PATCH', path, { ...options, data }),
	delete: <T = any>(path: string, options?: { params?: HttpParams; headers?: HttpHeaders }) =>
		requestData<T>('DELETE', path, options),
};

export interface DriverLoginPayload {
	username: string;
	password: string;
}

export interface DriverLoginResponse {
	token: string;
	access_token: string;
	refresh_token: string;
	user: {
		id: string;
		username: string;
		fullName: string;
		phone: string;
		email: string;
		avatarUrl: string;
	};
	driver: {
		id: string;
		name: string;
		phone: string;
		licenseNumber: string;
	};
}

export interface DriverCheckInPayload {
	ticketNumber: string;
	qrCode: string;
}

export interface AppPreferencesResponse {
	theme: string;
	colorPrimary: string;
	colorSecondary: string;
	mobileappLogoUrl: string;
	webIconUrl: string;
	oaTitle: string;
	oaBackofficeTitle: string;
}

export interface DriverCheckInResponse {
  bookingId: string;
  bookingReference: string;
  total: number;
  addonTotal: number;
  status: string;
  cashOnHand: number;
}

const getAuthorizationHeader = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

export const driverLogin = async (
	payload: DriverLoginPayload,
): Promise<DriverLoginResponse> => {
	return apiClient.post<DriverLoginResponse>('/driver/login', payload);
};

export const getDriverTrips = async <T = any>(date: string, token: string): Promise<T> => {
	return apiClient.get<T>('/driver/trips', {
		params: { date },
		headers: getAuthorizationHeader(token),
	});
};

export const driverCheckIn = async <T = any>(
	payload: DriverCheckInPayload,
	token: string,
): Promise<T> => {
	return apiClient.post<T>('/driver/checkin', payload, {
		headers: getAuthorizationHeader(token),
	});
};
// curl /api/driver/sell \
//   --request POST \
//   --header 'Content-Type: application/json' \
//   --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
//   --data '{
//   "tripId": "",
//   "passengers": [
//     {
//       "seatNumber": "",
//       "fullName": "",
//       "phone": "",
//       "tierId": ""
//     }
//   ],
//   "addOns": [
//     {
//       "addOnId": "",
//       "qty": 1
//     }
//   ]
// }'

export const driverSellTicket = async <T = any>(
	payload: any,
	token: string,
): Promise<DriverCheckInResponse> => {
	return apiClient.post<DriverCheckInResponse>('/driver/sell', payload, {
		headers: getAuthorizationHeader(token),
	});
}
export const getPreferences = async (): Promise<AppPreferencesResponse> => {
	return apiClient.get<AppPreferencesResponse>('/preferences');
};

export const getBookingDetail = async <T = any>(id: string, token?: string): Promise<T> => {
	return apiClient.get<T>(`/bookings/${id}`, {
		headers: token ? getAuthorizationHeader(token) : getAuthHeaders(),
	});
};

export interface DriverMeResponse {
	driver: {
		id: string;
		name: string;
		license_number: string;
		phone: string;
		is_active: boolean;
		earning_per_round: number;
		notes: string | null;
		updated_at: string;
	};
	user: {
		id: string;
		username: string;
		email: string | null;
		national_id: string | null;
		full_name: string;
		phone: string;
		avatar_url: string | null;
	};
	today_rounds_count: number;
	today_earnings: number;
	today_window_start: string;
	today_window_end: string;
	current_shift: unknown | null;
	alerts: unknown[];
}

export const getDriverMe = async (token: string): Promise<DriverMeResponse> => {
	return apiClient.get<DriverMeResponse>('/driver/me', {
		headers: getAuthorizationHeader(token),
	});
};

export interface UpdateDriverMePayload {
	name?: string;
	phone?: string;
	current_password?: string;
	new_password?: string;
}

export const updateDriverMe = async (
	payload: UpdateDriverMePayload,
	token: string,
): Promise<DriverMeResponse> => {
	return apiClient.patch<DriverMeResponse>('/driver/me', payload, {
		headers: getAuthorizationHeader(token),
	});
};

export const logoutApi = async (refreshToken?: string): Promise<void> => {
	await apiClient.post('/auth/logout', refreshToken ? { refresh_token: refreshToken } : {});
};

export interface ShiftStartPayload {
	trip_id: string;
	vehicle_id: string;
	start_km: number;
	start_mileage: number;
	start_battery: number;
}

export interface ShiftStopPayload {
	stop_km: number;
	stop_mileage: number;
	stop_battery: number;
	notes: string;
}

export interface Province {
	id: string;
	name: string;
	nameEn: string | null;
	routeIds: string[];
}

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
		destination:
			destinationName ||
			trip.destination ||
			trip.destinationName ||
			trip.destinationProvinceName ||
			destinationProvinceId,
		origin_id: originProvinceId,
		destination_id: destinationProvinceId,
		duration: trip.duration || '',
	};

	route.origin = originName || route.origin;
	route.destination = destinationName || route.destination;

	const busType = trip.bus_type || {
		id: trip.busTypeId || trip.bus_type_id || trip.busType,
		name: trip.busType || trip.busTypeName || '',
		amenities: trip.amenities || [],
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
		bus_number: trip.bus_number || trip.busNumber || trip.busPlate || '',
		origin_province_id: originProvinceId,
		destination_province_id: destinationProvinceId,
	};
};

export const getDriverTripPassengers = async (tripId: string) => {
	try {
		return await apiClient.get(`/driver/trips/${tripId}/passengers`, {
			headers: getAuthHeaders(),
		});
	} catch (err) {
		return getErrorData(err);
	}
};

export const getTripSeats = async (tripId: string) => apiClient.get(`/trips/${tripId}/seats`);

export const getProvinces = async (routeId?: string): Promise<Province[]> => {
	const response = await apiClient.get<Province[]>('/provinces', {
		params: routeId ? { routeId } : undefined,
	});
	return response || [];
};

export const getTripDetail = async (id: string) => {
	const [tripResponse, provinces] = await Promise.all([
		apiClient.get(`/trips/${id}`),
		getProvinces().catch((err) => {
			console.warn('Unable to load provinces', err);
			return [];
		}),
	]);

	return normalizeTripDetail(tripResponse, provinces);
};

export const getBusStops = async (
	routeId: string,
	routeMeta?: {
		originProvinceId?: string;
		destinationProvinceId?: string;
		origin?: string;
		destination?: string;
	},
) => {
	try {
		const res = await apiClient.get<any[]>(`/bus-stops`, {
			params: { routeId },
		});

		return (res || []).map((stop: any) => ({
			...stop,
			order: stop.stopOrder,
			route_id: {
				id: stop.routeId,
				origin_id: routeMeta?.originProvinceId,
				destination_id: routeMeta?.destinationProvinceId,
				origin: routeMeta?.origin,
				destination: routeMeta?.destination,
			},
		}));
	} catch (err) {
		return getErrorData(err);
	}
};

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

export const getTripPassengerLocations = async (
	tripId: string,
): Promise<TripPassengerLocationsResponse> => {
	return apiClient.get<TripPassengerLocationsResponse>(`/trips/${tripId}/passenger-locations`, {
		headers: getAuthHeaders(),
	});
};

export const checkInSelf = async (ticketNumber: string, qrCode: string) => {
	return apiClient.post(`/checkin/self`, { ticketNumber, qrCode }, { headers: getAuthHeaders() });
};

export interface CreatePaymentQrPayload {
	amount: number;
}

export const createPaymentQr = async (payload: CreatePaymentQrPayload) => {
	return apiClient.post(`/payment/qr`, payload, {
		params: toHttpParams({ amount: payload.amount }),
	});
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
	return apiClient.post(`/bookings`, payload, {
		headers: {
			...getAuthHeaders(),
			'Content-Type': 'application/json',
		},
	});
};

export const getPaymentTransaction = async (transactionId: string) => {
	return apiClient.get(`/payment/transaction/${transactionId}`);
};

export const getDriverRounds = async (limit: number = 10, offset: number = 0) => {
	return apiClient.get(`/driver/rounds`, {
		params: toHttpParams({ limit, offset }),
		headers: getAuthHeaders(),
	});
};

export interface DriverLocationPayload {
	latitude: number;
	longitude: number;
	speed_kmh: number;
	heading_deg: number;
}

export const updateDriverLocation = async (payload: DriverLocationPayload) => {
	return apiClient.post(`/driver/location`, payload, {
		headers: getAuthHeaders(),
	});
};

export const startShift = async <T = any>(payload: any): Promise<T> => {
	try {
		return await apiClient.post<T>('/driver/shift/start', payload, {
			headers: getAuthHeaders(),
		});
	} catch (err) {
		return getErrorData(err) as T;
	}
};

export const stopShift = async <T = any>(payload: any): Promise<T> => {
	try {
		return await apiClient.post<T>('/driver/shift/stop', payload, {
			headers: getAuthHeaders(),
		});
	} catch (err) {
		return getErrorData(err) as T;
	}
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
		const response = await apiClient.get('/driver/call-customer', {
			params: toHttpParams(params),
			headers: getAuthHeaders(),
		});
		return response || [];
	} catch (err: any) {
		if (getErrorStatus(err) === 404) {
			console.warn('Nova API endpoint /driver/call-customer is not available yet.');
			return [];
		}
		throw err;
	}
};

export const saveCallCustomer = async (payload: CallCustomerPayload) => {
	try {
		return await apiClient.post('/driver/call-customer', payload, {
			headers: getAuthHeaders(),
		});
	} catch (err: any) {
		if (getErrorStatus(err) === 404) {
			console.warn('Nova API endpoint /driver/call-customer is not available yet.');
			return { skipped: true };
		}
		throw err;
	}
};

export default apiClient;
