const validWeightUnits = new Set(['KG','G','MG']);

export function getCatalogWeightOptions(item){
	if(!Array.isArray(item?.weightOptions)) return [];
	const uniqueOptions = new Map();
	item.weightOptions.forEach(option=>{
		const amount = Number(option?.amount);
		const unit = option?.unit;
		if(!Number.isFinite(amount) || amount <= 0 || !validWeightUnits.has(unit)) return;
		const key = `${amount}:${unit}`;
		if(!uniqueOptions.has(key)) uniqueOptions.set(key,{amount,unit});
	});
	return [...uniqueOptions.values()].slice(0,20);
}

export function getCatalogSelectionKey(selection){
	if(!selection || typeof selection !== 'object') return 'none';
	if(selection.type === 'size' && typeof selection.value === 'string' && selection.value.trim() && selection.value.length <= 30){
		return `size:${selection.value.trim().toLocaleLowerCase()}`;
	}
	const amount = Number(selection.amount);
	if(selection.type === 'weight' && Number.isFinite(amount) && amount > 0 && validWeightUnits.has(selection.unit)){
		return `weight:${amount}:${selection.unit}`;
	}
	return 'none';
}

export function getCatalogUnitPrice(item){
	const price = Number(item.price);
	const discount = Number(item.discount);
	const validPrice = Number.isFinite(price) ? Math.max(0,price) : 0;
	const validDiscount = Number.isFinite(discount) ? Math.min(100,Math.max(0,discount)) : 0;
	const discountedPrice = validPrice - validPrice * validDiscount / 100;
	if(item.selection?.type !== 'weight' || getCatalogSelectionKey(item.selection) === 'none') return discountedPrice;
	const amount = Number(item.selection.amount);
	const kilograms = item.selection.unit === 'MG' ? amount / 1000000
		: item.selection.unit === 'G' ? amount / 1000
			: amount;
	return discountedPrice * kilograms;
}

export function getCatalogSelectionLabel(selection,isBangla=false){
	if(selection?.type === 'size' && typeof selection.value === 'string' && selection.value.trim() && selection.value.length <= 30){
		return `${isBangla ? 'সাইজ' : 'Size'}: ${selection.value.trim()}`;
	}
	const amount = Number(selection?.amount);
	if(selection?.type === 'weight' && Number.isFinite(amount) && amount > 0 && validWeightUnits.has(selection.unit)){
		return `${isBangla ? 'ওজন' : 'Weight'}: ${amount} ${selection.unit}`;
	}
	return '';
}
