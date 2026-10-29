const validPromoCode = /^[A-Z0-9_-]{3,32}$/;

export function normalizePromoCode(value){
	const code = String(value || '').trim().toUpperCase();
	return validPromoCode.test(code) ? code : null;
}

export function isValidPromo(promo){
	if(!promo || promo.active !== true || normalizePromoCode(promo.code) !== promo.code) return false;
	if(promo.type === 'free_delivery') return true;
	const value = Number(promo.value);
	if(!Number.isFinite(value) || value <= 0) return false;
	if(promo.type === 'percent') return value <= 100;
	return promo.type === 'fixed' && value <= 100000;
}

export function getPromoDiscount(promo,subtotal,deliveryCharge=0){
	if(!isValidPromo(promo)) return 0;
	const validSubtotal = Number.isFinite(Number(subtotal)) ? Math.max(0,Number(subtotal)) : 0;
	const validDeliveryCharge = Number.isFinite(Number(deliveryCharge)) ? Math.max(0,Number(deliveryCharge)) : 0;
	let discount = 0;
	if(promo.type === 'free_delivery') discount = validDeliveryCharge;
	if(promo.type === 'percent') discount = validSubtotal * Number(promo.value) / 100;
	if(promo.type === 'fixed') discount = Math.min(validSubtotal,Number(promo.value));
	return Math.round((discount + Number.EPSILON) * 100) / 100;
}
