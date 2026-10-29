import { db } from '../../shared/firebase.js?v=2';
import { getCatalogSelectionKey, getCatalogSelectionLabel, getCatalogUnitPrice, getCatalogWeightOptions } from '../../shared/catalog-options.js?v=3';
import { getDeliveryCharge } from '../../shared/delivery-pricing.js?v=1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { bangladeshDistricts } from './bangladesh-locations.js';

let storedCart = [];
try{
	const parsedCart = JSON.parse(localStorage.getItem('cart') || '[]');
	if(Array.isArray(parsedCart)) storedCart = parsedCart.filter(item=>item && typeof item === 'object' && (item.id || item.name));
}catch(error){
	console.error('Saved cart data could not be read:', error);
	localStorage.removeItem('cart');
}

const cart = [];
const el = document.getElementById('cart');
const checkoutBtn = document.getElementById('checkout');
const checkoutForm = document.getElementById('checkout-form');
const checkoutError = document.getElementById('checkout-error');
const deliveryFields = document.getElementById('delivery-fields');
const customerNameInput = document.getElementById('customer-name');
const customerPhoneInput = document.getElementById('customer-phone');
const customerAddressInput = document.getElementById('customer-address');
const districtSearch = document.getElementById('district-search');
const districtSelect = document.getElementById('customer-district');
const districtTrigger = document.getElementById('district-trigger');
const districtValue = document.getElementById('district-value');
const districtPanel = document.getElementById('district-panel');
const districtOptions = document.getElementById('district-options');
const upazilaSearch = document.getElementById('upazila-search');
const upazilaSelect = document.getElementById('customer-upazila');
const upazilaTrigger = document.getElementById('upazila-trigger');
const upazilaValue = document.getElementById('upazila-value');
const upazilaPanel = document.getElementById('upazila-panel');
const upazilaOptions = document.getElementById('upazila-options');
const cartItemsCount = document.getElementById('cart-items-count');
let checkoutSettingsReady = false;
let siteSettings = {
	deliveryChargeDhaka:Number(localStorage.getItem('deliveryChargeDhaka')) || 0,
	deliveryChargeOutside:Number(localStorage.getItem('deliveryChargeOutside')) || 0
};
const catalogUrl = location.pathname === '/cart.html'
	? new URL('/', location.origin)
	: new URL('index.html', document.baseURI);
catalogUrl.search = location.search;
document.querySelectorAll('a[href="index.html"]').forEach(link=>{ link.href = catalogUrl.href; });

function updateRestaurantName(value){
	const name = value || 'Your Business';
	document.querySelectorAll('[data-restaurant-name]').forEach(element=>{ element.textContent = name; });
	document.title = `${name} | Your Cart`;
}

updateRestaurantName(localStorage.getItem('restaurantName'));

function applyButtonColor(value){
	const color = String(value || '').trim();
	if(!/^#[0-9a-fA-F]{6}$/.test(color)) return;
	const red = parseInt(color.slice(1,3),16);
	const green = parseInt(color.slice(3,5),16);
	const blue = parseInt(color.slice(5,7),16);
	const foreground = (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? '#17221d' : '#ffffff';
	document.documentElement.style.setProperty('--button-color',color);
	document.documentElement.style.setProperty('--button-foreground',foreground);
}

function getCartImageUrl(url){
	const uploadPath = '/image/upload/';
	if(typeof url !== 'string' || !url.includes('res.cloudinary.com/') || !url.includes(uploadPath)) return url;
	return url.replace(uploadPath,`${uploadPath}f_auto,q_auto:good,c_fill,g_auto,w_336,h_336/`);
}

function getLocationLabel(location){
	return localStorage.getItem('lang') === 'bn' ? location.bn : location.en;
}

function makeLocationOption(location,selectedId){
	const option = document.createElement('button');
	option.type = 'button';
	option.className = 'searchable-select-option';
	option.setAttribute('role','option');
	option.setAttribute('aria-selected',String(location.id === selectedId));
	option.dataset.value = location.id;
	option.textContent = getLocationLabel(location);
	return option;
}

function renderDistrictOptions(){
	const selectedDistrict = districtSelect.value;
	const query = districtSearch.value.trim().toLocaleLowerCase();
	const matches = bangladeshDistricts.filter(district=>
		`${district.en} ${district.bn}`.toLocaleLowerCase().includes(query)
	);
	const isBangla = localStorage.getItem('lang') === 'bn';
	districtSelect.replaceChildren(new Option('', ''));
	const selected = bangladeshDistricts.find(district=>district.id === selectedDistrict);
	const placeholder = isBangla ? 'জেলা নির্বাচন করুন' : 'Select a district';
	districtValue.textContent = selected ? getLocationLabel(selected) : placeholder;
	bangladeshDistricts.forEach(district=>districtSelect.add(new Option(getLocationLabel(district),district.id)));
	districtSelect.value = selectedDistrict;
	districtOptions.replaceChildren(...matches.map(district=>makeLocationOption(district,selectedDistrict)));
}

function renderUpazilaOptions(){
	const selectedUpazila = upazilaSelect.value;
	const district = bangladeshDistricts.find(item=>item.id === districtSelect.value);
	const query = upazilaSearch.value.trim().toLocaleLowerCase();
	const matches = district
		? district.upazilas.filter(upazila=>`${upazila.en} ${upazila.bn}`.toLocaleLowerCase().includes(query))
		: [];
	const isBangla = localStorage.getItem('lang') === 'bn';
	const selected = district?.upazilas.find(upazila=>upazila.id === selectedUpazila);
	upazilaTrigger.disabled = !district;
	upazilaSearch.disabled = !district;
	upazilaSearch.placeholder = isBangla ? 'উপজেলা খুঁজতে লিখুন' : 'Type to search upazilas';
	upazilaSelect.disabled = !district;
	upazilaSelect.replaceChildren(new Option('', ''));
	if(district) district.upazilas.forEach(upazila=>upazilaSelect.add(new Option(getLocationLabel(upazila),upazila.id)));
	upazilaSelect.value = selected?.id || '';
	upazilaValue.textContent = selected
		? getLocationLabel(selected)
		: (district ? (isBangla ? 'উপজেলা নির্বাচন করুন' : 'Select an upazila') : (isBangla ? 'আগে জেলা নির্বাচন করুন' : 'Select a district first'));
	upazilaOptions.replaceChildren(...matches.map(upazila=>makeLocationOption(upazila,selectedUpazila)));
}

function applyCheckoutLanguage(){
	const isBangla = localStorage.getItem('lang') === 'bn';
	document.documentElement.lang = isBangla ? 'bn' : 'en';
	deliveryFields.querySelectorAll('[data-en][data-bn]').forEach(label=>{
		label.textContent = label.dataset[isBangla ? 'bn' : 'en'];
	});
	checkoutBtn.textContent = isBangla ? 'হোয়াটসঅ্যাপে অর্ডার পাঠান' : 'Send order on WhatsApp';
	districtSearch.placeholder = isBangla ? 'জেলা খুঁজতে লিখুন' : 'Type to search districts';
	renderDistrictOptions();
	renderUpazilaOptions();
}

applyCheckoutLanguage();

function closeLocationDropdown(widget,panel,trigger){
	panel.hidden = true;
	trigger.setAttribute('aria-expanded','false');
	widget.classList.remove('is-open');
}

function openLocationDropdown(widget,panel,trigger,search,renderOptions){
	const otherDropdowns = [
		[districtWidget,districtPanel,districtTrigger],
		[upazilaWidget,upazilaPanel,upazilaTrigger]
	];
	otherDropdowns.forEach(([otherWidget,otherPanel,otherTrigger])=>{
		if(otherWidget !== widget) closeLocationDropdown(otherWidget,otherPanel,otherTrigger);
	});
	search.value = '';
	renderOptions();
	panel.hidden = false;
	trigger.setAttribute('aria-expanded','true');
	widget.classList.add('is-open');
	search.focus();
}

const districtWidget = document.getElementById('district-widget');
const upazilaWidget = document.getElementById('upazila-widget');

districtTrigger.addEventListener('click',()=>{
	if(districtPanel.hidden) openLocationDropdown(districtWidget,districtPanel,districtTrigger,districtSearch,renderDistrictOptions);
	else closeLocationDropdown(districtWidget,districtPanel,districtTrigger);
});
upazilaTrigger.addEventListener('click',()=>{
	if(upazilaPanel.hidden) openLocationDropdown(upazilaWidget,upazilaPanel,upazilaTrigger,upazilaSearch,renderUpazilaOptions);
	else closeLocationDropdown(upazilaWidget,upazilaPanel,upazilaTrigger);
});

districtSearch.addEventListener('input',renderDistrictOptions);
upazilaSearch.addEventListener('input',renderUpazilaOptions);
districtOptions.addEventListener('click',event=>{
	const option = event.target.closest('button[data-value]');
	if(!option) return;
	districtSelect.value = option.dataset.value;
	districtSearch.value = '';
	upazilaSelect.value = '';
	upazilaSearch.value = '';
	renderDistrictOptions();
	renderUpazilaOptions();
	renderCart();
	closeLocationDropdown(districtWidget,districtPanel,districtTrigger);
	checkoutError.textContent = '';
});
upazilaOptions.addEventListener('click',event=>{
	const option = event.target.closest('button[data-value]');
	if(!option) return;
	upazilaSelect.value = option.dataset.value;
	upazilaSearch.value = '';
	renderUpazilaOptions();
	closeLocationDropdown(upazilaWidget,upazilaPanel,upazilaTrigger);
	checkoutError.textContent = '';
});
document.addEventListener('click',event=>{
	if(!districtWidget.contains(event.target)) closeLocationDropdown(districtWidget,districtPanel,districtTrigger);
	if(!upazilaWidget.contains(event.target)) closeLocationDropdown(upazilaWidget,upazilaPanel,upazilaTrigger);
});
document.addEventListener('keydown',event=>{
	if(event.key !== 'Escape') return;
	if(!districtPanel.hidden){
		closeLocationDropdown(districtWidget,districtPanel,districtTrigger);
		districtTrigger.focus();
	}
	if(!upazilaPanel.hidden){
		closeLocationDropdown(upazilaWidget,upazilaPanel,upazilaTrigger);
		upazilaTrigger.focus();
	}
});

districtSelect.addEventListener('change',()=>{
	upazilaSearch.value = '';
	upazilaSelect.value = '';
	renderUpazilaOptions();
	renderCart();
});
window.addEventListener('storage',event=>{
	if(event.key === 'lang'){
		applyCheckoutLanguage();
		renderCart();
	}
});

applyButtonColor(localStorage.getItem('buttonColor'));
window.addEventListener('storage',event=>{
	if(event.key === 'buttonColor') applyButtonColor(event.newValue);
});

function productKey(item){
	return `${productIdentity(item)}|selection:${getCatalogSelectionKey(item.selection)}`;
}

function productIdentity(item){
	return item.id ? `id:${item.id}` : `name:${item.name || ''}|${item.category || ''}`;
}

function availableSizes(item){
	const options = Array.isArray(item.selectionOptions)
		? [...new Set(item.selectionOptions.filter(option=>typeof option === 'string').map(option=>option.trim()).filter(option=>option && option.length <= 30))]
		: [];
	return options.length ? options.slice(0,20) : ['M','L','XL','XXL'];
}

function availableWeightUnits(item){
	const validUnits = new Set(['KG','G','MG']);
	const options = Array.isArray(item.weightUnits) ? [...new Set(item.weightUnits.filter(unit=>validUnits.has(unit)))] : ['KG','MG'];
	return options.length ? options : ['KG'];
}

function hasValidWeightSelection(item){
	if(item.selection?.type !== 'weight' || getCatalogSelectionKey(item.selection) === 'none') return false;
	const configuredOptions = getCatalogWeightOptions(item);
	if(configuredOptions.length){
		return configuredOptions.some(option=>option.amount === Number(item.selection.amount) && option.unit === item.selection.unit);
	}
	return availableWeightUnits(item).includes(item.selection.unit);
}

function selectionIsValid(item){
	if(item.selectionType === 'size'){
		return item.selection?.type === 'size'
			&& typeof item.selection.value === 'string'
			&& availableSizes(item).some(size=>size.toLocaleLowerCase() === item.selection.value.trim().toLocaleLowerCase())
			&& getCatalogSelectionKey(item.selection) !== 'none';
	}
	if(item.selectionType === 'weight'){
		return hasValidWeightSelection(item);
	}
	return true;
}

function updateCheckoutAvailability(){
	checkoutBtn.disabled = !checkoutSettingsReady || !cart.length || cart.some(item=>!selectionIsValid(item));
}

function setCartSelection(index,selection){
	const item = cart[index];
	if(!item) return;
	item.selection = selection;
	const selectionKey = getCatalogSelectionKey(selection);
	if(selectionKey !== 'none'){
		const duplicateIndex = cart.findIndex((entry,entryIndex)=>
			entryIndex !== index
			&& productIdentity(entry) === productIdentity(item)
			&& getCatalogSelectionKey(entry.selection) === selectionKey
		);
		if(duplicateIndex !== -1){
			cart[duplicateIndex].quantity += item.quantity;
			cart.splice(index,1);
		}
	}
	saveCart();
	renderCart();
}

function refreshCartPrices(){
	let total = 0;
	cart.forEach((item,index)=>{
		const isValid = selectionIsValid(item);
		const unitPrice = itemPrice(item);
		const hasWeightSelection = item.selectionType === 'weight' && isValid;
		const lineTotal = item.selectionType === 'weight' && !isValid ? 0 : unitPrice * item.quantity;
		total += lineTotal;
		const price = el.querySelector(`[data-cart-price="${index}"]`);
		const itemTotal = el.querySelector(`[data-cart-total="${index}"]`);
		const selectionLabel = el.querySelector(`[data-cart-selection="${index}"]`);
		if(price){
			price.textContent = item.selectionType === 'weight' && !hasWeightSelection
				? `৳${formatMoney(getCatalogUnitPrice({...item,selection:null}))} / kg`
				: `৳${formatMoney(unitPrice)} each`;
		}
		if(itemTotal){
			itemTotal.textContent = isValid ? `৳${formatMoney(lineTotal)}` : (localStorage.getItem('lang') === 'bn' ? 'সাইজ বা ওজন নির্বাচন করুন' : 'Select a size or weight');
		}
		if(selectionLabel){
			selectionLabel.textContent = itemSelectionLabel(item);
			selectionLabel.hidden = !selectionLabel.textContent;
		}
	});
	const summaryTotal = el.querySelector('.cart-summary strong');
	if(summaryTotal) summaryTotal.textContent = `৳${formatMoney(total)}`;
	updateCheckoutAvailability();
}

function createSelectionControls(item,index){
	const group = document.createElement('fieldset');
	group.className = 'cart-selection-group';
	const legend = document.createElement('legend');
	const isBangla = localStorage.getItem('lang') === 'bn';
	const isSize = item.selectionType === 'size';
	legend.textContent = isSize ? (isBangla ? 'সাইজ নির্বাচন করুন' : 'Choose a size') : (isBangla ? 'ওজন নির্বাচন করুন' : 'Choose weight');
	group.appendChild(legend);

	if(isSize){
		const options = document.createElement('div');
		options.className = 'cart-option-chips';
		availableSizes(item).forEach(size=>{
			const label = document.createElement('label');
			label.className = 'cart-option-chip';
			const radio = document.createElement('input');
			radio.type = 'radio';
			radio.name = `cart-size-${index}`;
			radio.value = size;
			radio.checked = item.selection?.type === 'size'
				&& typeof item.selection.value === 'string'
				&& item.selection.value.trim().toLocaleLowerCase() === size.toLocaleLowerCase();
			radio.setAttribute('aria-label',size);
			radio.addEventListener('change',()=>setCartSelection(index,{type:'size',value:size}));
			const text = document.createElement('span');
			text.textContent = size;
			label.append(radio,text);
			options.appendChild(label);
		});
		group.appendChild(options);
		return group;
	}

	const configuredWeightOptions = getCatalogWeightOptions(item);
	if(configuredWeightOptions.length){
		const options = document.createElement('div');
		options.className = 'cart-option-chips';
		configuredWeightOptions.forEach(option=>{
			const label = document.createElement('label');
			label.className = 'cart-option-chip';
			const radio = document.createElement('input');
			radio.type = 'radio';
			radio.name = `cart-weight-option-${index}`;
			radio.value = `${option.amount}:${option.unit}`;
			radio.checked = item.selection?.type === 'weight'
				&& Number(item.selection.amount) === option.amount
				&& item.selection.unit === option.unit;
			radio.setAttribute('aria-label',`${option.amount} ${option.unit}`);
			radio.addEventListener('change',()=>setCartSelection(index,{type:'weight',amount:option.amount,unit:option.unit}));
			const text = document.createElement('span');
			text.textContent = `${option.amount} ${option.unit}`;
			label.append(radio,text);
			options.appendChild(label);
		});
		group.appendChild(options);
		return group;
	}

	const amountLabel = document.createElement('label');
	amountLabel.className = 'cart-weight-label';
	amountLabel.textContent = isBangla ? 'পরিমাণ' : 'Amount';
	const amount = document.createElement('input');
	amount.type = 'number';
	amount.className = 'cart-weight-amount';
	amount.min = '0.001';
	amount.step = 'any';
	amount.inputMode = 'decimal';
	amount.value = item.selection?.type === 'weight' ? String(item.selection.amount) : '';
	amountLabel.appendChild(amount);
	group.appendChild(amountLabel);

	const units = document.createElement('div');
	units.className = 'cart-option-chips';
	const unitInputs = [];
	availableWeightUnits(item).forEach((unit,unitIndex)=>{
		const label = document.createElement('label');
		label.className = 'cart-option-chip';
		const radio = document.createElement('input');
		radio.type = 'radio';
		radio.name = `cart-unit-${index}`;
		radio.value = unit;
		radio.checked = item.selection?.type === 'weight'
			? item.selection.unit === unit
			: unitIndex === 0;
		radio.setAttribute('aria-label',unit);
		const text = document.createElement('span');
		text.textContent = unit;
		label.append(radio,text);
		units.appendChild(label);
		unitInputs.push(radio);
	});
	group.appendChild(units);

	const getWeightSelection = ()=>{
		const amountValue = amount.valueAsNumber;
		const unit = unitInputs.find(radio=>radio.checked)?.value;
		return Number.isFinite(amountValue) && amountValue >= Number(amount.min) && unit
			? {type:'weight',amount:amountValue,unit}
			: null;
	};
	amount.addEventListener('input',()=>{
		item.selection = getWeightSelection();
		saveCart();
		refreshCartPrices();
	});
	amount.addEventListener('change',()=>setCartSelection(index,getWeightSelection()));
	unitInputs.forEach(radio=>radio.addEventListener('change',()=>setCartSelection(index,getWeightSelection())));
	return group;
}

if(Array.isArray(storedCart)){
	storedCart.forEach(item=>{
		const savedQuantity = Number(item.quantity);
		const quantity = Number.isFinite(savedQuantity) && savedQuantity > 0 ? Math.floor(savedQuantity) : 1;
		const existing = cart.find(entry=>productKey(entry) === productKey(item));
		if(existing) existing.quantity += quantity;
		else cart.push({...item,quantity});
	});
}

function saveCart(){
	localStorage.setItem('cart',JSON.stringify(cart));
}

async function loadBusinessSettings(){
	if(!db){
		checkoutSettingsReady = true;
		updateCheckoutAvailability();
		return;
	}
	try{
		const settings = await getDoc(doc(db,'config','site'));
		if(!settings.exists()) return;
		const data = settings.data();
		siteSettings = {
			...data,
			deliveryChargeDhaka:Number(data.deliveryChargeDhaka) || 0,
			deliveryChargeOutside:Number(data.deliveryChargeOutside) || 0
		};
		localStorage.setItem('deliveryChargeDhaka',String(siteSettings.deliveryChargeDhaka));
		localStorage.setItem('deliveryChargeOutside',String(siteSettings.deliveryChargeOutside));
		if(data.restaurantName){
			localStorage.setItem('restaurantName', data.restaurantName);
			updateRestaurantName(data.restaurantName);
		}
		if(data.whatsapp){
			localStorage.setItem('whatsappNumber', data.whatsapp);
			localStorage.setItem('siteWhatsApp', data.whatsapp);
		}
		if(data.buttonColor) applyButtonColor(data.buttonColor);
	}catch(error){
		console.error('Business settings could not be loaded for checkout:', error);
	}finally{
		checkoutSettingsReady = true;
		renderCart();
		updateCheckoutAvailability();
	}
}

void loadBusinessSettings();

function itemPrice(item){
	return getCatalogUnitPrice(item);
}

function itemSelectionLabel(item){
	return getCatalogSelectionLabel(item.selection,localStorage.getItem('lang') === 'bn');
}

function formatMoney(amount){
	return Number(amount).toLocaleString(localStorage.getItem('lang') === 'bn' ? 'bn-BD' : 'en-BD',{maximumFractionDigits:2});
}

function cartSubtotal(){
	return cart.reduce((sum,item)=>{
		if(['size','weight'].includes(item.selectionType) && !selectionIsValid(item)) return sum;
		return sum + itemPrice(item) * item.quantity;
	},0);
}

function selectedDeliveryCharge(){
	const district = bangladeshDistricts.find(item=>item.id === districtSelect.value);
	return getDeliveryCharge(siteSettings,district);
}

function renderCart(){
	const subtotal = cartSubtotal();
	const deliveryCharge = selectedDeliveryCharge();
	const hasSelectedDistrict = Boolean(districtSelect.value);
	const total = subtotal + (hasSelectedDistrict ? deliveryCharge : 0);
	const itemCount = cart.reduce((sum,item)=>sum + item.quantity,0);
	if(cartItemsCount) cartItemsCount.textContent = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
	if(!cart.length){
		el.innerHTML = '<div class="cart-empty"><span class="cart-empty-icon" aria-hidden="true">&#128722;</span><h3>Your cart is empty</h3><p>Choose an item from the catalog to get started.</p><a class="cart-empty-link" href="index.html">Browse the catalog <span aria-hidden="true">&#8594;</span></a></div>';
		el.querySelector('.cart-empty-link').href = catalogUrl.href;
		updateCheckoutAvailability();
		return;
	}
	el.replaceChildren();
	const list = document.createElement('div');
	list.className = 'cart-list';
	cart.forEach((item,index)=>{
		const selectionValid = selectionIsValid(item);
		const unitPrice = itemPrice(item);
		const lineTotal = unitPrice * item.quantity;
		const row = document.createElement('article');
		row.className = 'cart-item';
		row.dataset.index = String(index);
		const imageUrl = item.images && item.images[0] && item.images[0].url ? item.images[0].url : item.image;
		if(imageUrl){
			const image = document.createElement('img');
			image.className = 'cart-item-image';
			image.src = getCartImageUrl(imageUrl);
			image.alt = item.name || 'Product';
			image.loading = 'lazy';
			row.appendChild(image);
		}else{
			const placeholder = document.createElement('div');
			placeholder.className = 'cart-item-image cart-item-placeholder';
			placeholder.textContent = 'No image';
			row.appendChild(placeholder);
		}

		const details = document.createElement('div');
		details.className = 'cart-item-details';
		const title = document.createElement('h2');
		title.className = 'cart-item-title';
		title.textContent = item.name || 'Product';
		details.appendChild(title);
		const selectionLabel = itemSelectionLabel(item);
		const selection = document.createElement('p');
		selection.className = 'cart-item-selection';
		selection.dataset.cartSelection = String(index);
		selection.textContent = selectionLabel;
		selection.hidden = !selectionLabel;
		details.appendChild(selection);
		if(['size','weight'].includes(item.selectionType)) details.appendChild(createSelectionControls(item,index));
		const price = document.createElement('p');
		price.className = 'cart-item-price';
		price.textContent = item.selectionType === 'weight' && !selectionValid
			? `৳${formatMoney(getCatalogUnitPrice({...item,selection:null}))} / kg`
			: `৳${formatMoney(unitPrice)} each`;
		price.dataset.cartPrice = String(index);
		const itemTotal = document.createElement('p');
		itemTotal.className = 'cart-item-line-total';
		itemTotal.textContent = ['size','weight'].includes(item.selectionType) && !selectionIsValid(item)
			? (localStorage.getItem('lang') === 'bn' ? 'সাইজ বা ওজন নির্বাচন করুন' : 'Select a size or weight')
			: `৳${formatMoney(lineTotal)}`;
		itemTotal.dataset.cartTotal = String(index);
		details.append(price,itemTotal);

		const controls = document.createElement('div');
		controls.className = 'cart-item-controls';
		const quantity = document.createElement('div');
		quantity.className = 'cart-quantity-controls';
		const decrease = document.createElement('button');
		decrease.type = 'button';
		decrease.className = 'quantity-button';
		decrease.dataset.action = 'decrease';
		decrease.dataset.index = String(index);
		decrease.setAttribute('aria-label',`Decrease ${item.name || 'product'} quantity`);
		decrease.textContent = '−';
		const quantityLabel = document.createElement('span');
		quantityLabel.className = 'quantity-value';
		quantityLabel.textContent = String(item.quantity);
		const increase = document.createElement('button');
		increase.type = 'button';
		increase.className = 'quantity-button';
		increase.dataset.action = 'increase';
		increase.dataset.index = String(index);
		increase.setAttribute('aria-label',`Increase ${item.name || 'product'} quantity`);
		increase.textContent = '+';
		quantity.append(decrease,quantityLabel,increase);
		const remove = document.createElement('button');
		remove.type = 'button';
		remove.className = 'remove-cart-item';
		remove.dataset.action = 'remove';
		remove.dataset.index = String(index);
		remove.textContent = 'Remove';
		controls.append(quantity,remove);
		row.append(details,controls);
		list.appendChild(row);
	});
	el.appendChild(list);
	const summary = document.createElement('div');
	summary.className = 'cart-summary';
	const makeSummaryRow = (className,labelText,valueText)=>{
		const row = document.createElement('div');
		row.className = `cart-summary-row ${className}`;
		const label = document.createElement('span');
		label.textContent = labelText;
		const value = document.createElement('strong');
		value.textContent = valueText;
		row.append(label,value);
		return row;
	};
	const isBangla = localStorage.getItem('lang') === 'bn';
	summary.appendChild(makeSummaryRow('cart-subtotal',isBangla ? 'পণ্যের মোট' : 'Subtotal',`৳${formatMoney(subtotal)}`));
	const deliveryRow = makeSummaryRow(
		'cart-delivery-charge',
		isBangla ? 'ডেলিভারি চার্জ' : 'Delivery charge',
		hasSelectedDistrict ? `৳${formatMoney(deliveryCharge)}` : (isBangla ? 'জেলা নির্বাচন করুন' : 'Select district')
	);
	deliveryRow.hidden = !hasSelectedDistrict;
	summary.appendChild(deliveryRow);
	summary.appendChild(makeSummaryRow('cart-grand-total',isBangla ? 'সর্বমোট' : 'Total',`৳${formatMoney(total)}`));
	el.appendChild(summary);
	updateCheckoutAvailability();
}

el.addEventListener('click',(event)=>{
	const button = event.target.closest('button[data-action]');
	if(!button) return;
	const index = Number(button.dataset.index);
	const item = cart[index];
	if(!item) return;
	if(button.dataset.action === 'increase') item.quantity += 1;
	if(button.dataset.action === 'decrease' && item.quantity > 1) item.quantity -= 1;
	if(button.dataset.action === 'remove') cart.splice(index,1);
	saveCart();
	renderCart();
});

renderCart();
saveCart();

checkoutForm.addEventListener('submit',async event=>{
	event.preventDefault();
	checkoutError.textContent = '';
	if(cart.some(item=>!selectionIsValid(item))){
		checkoutError.textContent = localStorage.getItem('lang') === 'bn'
			? 'অর্ডার করার আগে কার্টের প্রতিটি পণ্যের সাইজ বা ওজন নির্বাচন করুন।'
			: 'Choose a size or weight for every product before checkout.';
		return;
	}
	if(!customerNameInput.reportValidity() || !customerPhoneInput.reportValidity() || !customerAddressInput.reportValidity()) return;
	if(!districtSelect.value){
		checkoutError.textContent = localStorage.getItem('lang') === 'bn' ? 'জেলা নির্বাচন করুন।' : 'Select a district.';
		openLocationDropdown(districtWidget,districtPanel,districtTrigger,districtSearch,renderDistrictOptions);
		return;
	}
	if(!upazilaSelect.value){
		checkoutError.textContent = localStorage.getItem('lang') === 'bn' ? 'উপজেলা নির্বাচন করুন।' : 'Select an upazila.';
		openLocationDropdown(upazilaWidget,upazilaPanel,upazilaTrigger,upazilaSearch,renderUpazilaOptions);
		return;
	}
	if(!checkoutForm.reportValidity()) return;
	if(!cart.length) return;
	const isBangla = localStorage.getItem('lang') === 'bn';
	const number = (localStorage.getItem('whatsappNumber') || localStorage.getItem('siteWhatsApp') || '').replace(/\D/g,'');
	if(number.length < 7){
		checkoutError.textContent = isBangla
			? 'দোকানের WhatsApp নম্বর সেট করা নেই। Admin-এর WhatsApp পাতায় নম্বর যোগ করুন।'
			: 'The store WhatsApp number is missing. Add it in Admin → WhatsApp.';
		return;
	}

	const customer = {
		name:customerNameInput.value.trim(),
		phone:customerPhoneInput.value.trim(),
		district:districtSelect.selectedOptions[0]?.textContent || '',
		upazila:upazilaSelect.selectedOptions[0]?.textContent || '',
		address:customerAddressInput.value.trim()
	};
	const businessName = localStorage.getItem('restaurantName') || 'Your Business';
	const lines = isBangla
		? [`${businessName} - নতুন ডেলিভারি অর্ডার`,`নাম: ${customer.name}`,`ফোন: ${customer.phone}`,`জেলা: ${customer.district}`,`উপজেলা: ${customer.upazila}`,`ঠিকানা: ${customer.address}`,'','অর্ডার:']
		: [`${businessName} - New delivery order`,`Name: ${customer.name}`,`Phone: ${customer.phone}`,`District: ${customer.district}`,`Upazila: ${customer.upazila}`,`Address: ${customer.address}`,'','Items:'];
	const subtotal = cartSubtotal();
	const deliveryCharge = selectedDeliveryCharge();
	const total = subtotal + deliveryCharge;
	cart.forEach((item,index)=>{
		const itemName = isBangla && item.bnName ? item.bnName : item.name || 'Product';
		const lineTotal = itemPrice(item) * item.quantity;
		const selectionLabel = itemSelectionLabel(item);
		lines.push(`${index + 1}. ${item.quantity} × ${itemName}${selectionLabel ? ` (${selectionLabel})` : ''} - ৳${formatMoney(lineTotal)}`);
	});
	lines.push('',isBangla ? `পণ্যের মোট: ৳${formatMoney(subtotal)}` : `Subtotal: ৳${formatMoney(subtotal)}`);
	lines.push(isBangla ? `ডেলিভারি চার্জ: ৳${formatMoney(deliveryCharge)}` : `Delivery charge: ৳${formatMoney(deliveryCharge)}`);
	lines.push('',isBangla ? `মোট: ৳${formatMoney(total)}` : `Total: ৳${formatMoney(total)}`);
	lines.push(isBangla ? 'পেমেন্ট: ক্যাশ অন ডেলিভারি' : 'Payment: Cash on delivery');
	const whatsappUrl = `https://wa.me/${number}?text=${encodeURIComponent(lines.join('\n'))}`;
	const whatsappWindow = window.open(whatsappUrl,'_blank');
	if(whatsappWindow){
		whatsappWindow.opener = null;
		checkoutBtn.textContent = isBangla ? 'হোয়াটসঅ্যাপে বার্তা খুলেছে' : 'WhatsApp message opened';
	}else{
		window.location.assign(whatsappUrl);
	}
});
