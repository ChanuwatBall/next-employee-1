import axios from "axios";

export const API = "https://nova-api.rubyclaw.tech/api";

export const apiClient = axios.create({
	baseURL: API,
	headers: {
		"Content-Type": "application/json",
	},
});

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

const getAuthorizationHeader = (token: string) => ({
	Authorization: `Bearer ${token}`,
});

export const driverLogin = async (
	payload: DriverLoginPayload,
): Promise<DriverLoginResponse> => {
	const response = await apiClient.post<DriverLoginResponse>("/driver/login", payload);
	return response.data;
};

export const getDriverTrips = async <T = unknown>(date: string, token: string): Promise<T> => {
	const response = await apiClient.get<T>("/driver/trips", {
		params: { date },
		headers: getAuthorizationHeader(token),
	});

	return response.data;
};

export const driverCheckIn = async <T = unknown>(
	payload: DriverCheckInPayload,
	token: string,
): Promise<T> => {
	const response = await apiClient.post<T>("/driver/checkin", payload, {
		headers: getAuthorizationHeader(token),
	});

	return response.data;
};

export const getPreferences = async (): Promise<AppPreferencesResponse> => {
	const response = await apiClient.get<AppPreferencesResponse>("/preferences");
	return response.data;
}


export const getBookingDetail = async <T = unknown>(id: string, token: string): Promise<T> => {
	const response = await apiClient.get<T>(`/bookings/${id}`, {
		headers: getAuthorizationHeader(token),
	});

	return response.data;
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
	const response = await apiClient.get<DriverMeResponse>("/driver/me", {
		headers: getAuthorizationHeader(token),
	});
	return response.data;
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
	const response = await apiClient.patch<DriverMeResponse>("/driver/me", payload, {
		headers: getAuthorizationHeader(token),
	});
	return response.data;
};

export const logoutApi = async (refreshToken?: string): Promise<void> => {
	await apiClient.post("/auth/logout", refreshToken ? { refresh_token: refreshToken } : {});
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
