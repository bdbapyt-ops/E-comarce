export function getFirebaseWebConfig(environment){
	const config = {
		apiKey: environment.FIREBASE_API_KEY,
		authDomain: environment.FIREBASE_AUTH_DOMAIN,
		projectId: environment.FIREBASE_PROJECT_ID,
		storageBucket: environment.FIREBASE_STORAGE_BUCKET,
		messagingSenderId: environment.FIREBASE_MESSAGING_SENDER_ID,
		appId: environment.FIREBASE_APP_ID
	};
	const missing = Object.entries(config).filter(([,value])=>!value).map(([key])=>key);
	if(missing.length) throw new Error(`Missing Firebase configuration: ${missing.join(', ')}`);
	if(environment.FIREBASE_MEASUREMENT_ID) config.measurementId = environment.FIREBASE_MEASUREMENT_ID;
	return config;
}
