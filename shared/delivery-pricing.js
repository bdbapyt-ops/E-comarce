export function getDeliveryCharge(settings,district){
	if(!district) return 0;
	const key = String(district.en || district.id || '').trim().toLocaleLowerCase() === 'dhaka'
		? 'deliveryChargeDhaka'
		: 'deliveryChargeOutside';
	const charge = Number(settings?.[key]);
	return Number.isFinite(charge) && charge >= 0 ? charge : 0;
}
