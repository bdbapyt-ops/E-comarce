import { db } from '../../shared/firebase.js?v=2';
import { collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { normalizePromoCode } from '../../shared/promo-pricing.js?v=1';

const form = document.getElementById('promo-form');
const codeInput = document.getElementById('promo-code');
const typeInput = document.getElementById('promo-type');
const valueInput = document.getElementById('promo-value');
const valueField = document.getElementById('promo-value-field');
const valueHelp = document.getElementById('promo-value-help');
const status = document.getElementById('promo-status');
const saveButton = document.getElementById('save-promo');
const list = document.getElementById('promo-list');
const count = document.getElementById('promo-count');

function setStatus(message,state='info'){
	status.textContent = message;
	status.dataset.state = state;
}

function updateValueField(){
	const isPercent = typeInput.value === 'percent';
	const isFixed = typeInput.value === 'fixed';
	valueField.hidden = !isPercent && !isFixed;
	valueInput.required = isPercent || isFixed;
	valueInput.max = isPercent ? '100' : '100000';
	valueInput.step = isPercent ? '0.01' : '0.01';
	valueInput.placeholder = isPercent ? '20' : '100';
	valueHelp.textContent = isPercent
		? 'Enter a percentage from 0.01 to 100.'
		: 'Enter a discount between ৳0.01 and ৳100,000.';
}

function formatOffer(promo){
	if(promo.type === 'free_delivery') return 'Free delivery';
	if(promo.type === 'percent') return `${Number(promo.value)}% off`;
	if(promo.type === 'fixed') return `৳${Number(promo.value).toLocaleString('en-BD',{maximumFractionDigits:2})} off`;
	return 'Invalid offer';
}

function renderPromos(snapshot){
	const promos = snapshot.docs.map(entry=>({id:entry.id,...entry.data()}))
		.sort((left,right)=>left.code.localeCompare(right.code));
	count.textContent = String(promos.length);
	list.replaceChildren();
	if(!promos.length){
		const empty = document.createElement('p');
		empty.className = 'promo-empty';
		empty.textContent = 'No promo codes yet.';
		list.appendChild(empty);
		return;
	}
	promos.forEach(promo=>{
		const card = document.createElement('article');
		card.className = 'promo-card';
		const details = document.createElement('div');
		details.className = 'promo-card-details';
		const code = document.createElement('strong');
		code.textContent = promo.code || promo.id;
		const offer = document.createElement('span');
		offer.textContent = `${formatOffer(promo)} · ${promo.active === true ? 'Active' : 'Inactive'}`;
		details.append(code,offer);
		const remove = document.createElement('button');
		remove.type = 'button';
		remove.className = 'admin-account-remove';
		remove.textContent = 'Delete';
		remove.setAttribute('aria-label',`Delete promo ${promo.code || promo.id}`);
		remove.addEventListener('click',async()=>{
			if(!window.confirm(`Delete promo code ${promo.code || promo.id}?`)) return;
			remove.disabled = true;
			try{
				await deleteDoc(doc(db,'promotions',promo.id));
				setStatus(`Promo ${promo.code || promo.id} deleted.`, 'success');
			}catch(error){
				console.error('Could not delete promo code:',error);
				setStatus(`Could not delete promo code: ${error.message}`, 'error');
				remove.disabled = false;
			}
		});
		card.append(details,remove);
		list.appendChild(card);
	});
}

typeInput.addEventListener('change',updateValueField);
form.addEventListener('submit',async event=>{
	event.preventDefault();
	const code = normalizePromoCode(codeInput.value);
	const type = typeInput.value;
	const value = valueInput.valueAsNumber;
	if(!db){
		setStatus('Firebase Firestore is not connected; the promo was not saved.', 'error');
		return;
	}
	if(!code){
		setStatus('Use a promo code with 3–32 letters, numbers, hyphens, or underscores.', 'error');
		codeInput.focus();
		return;
	}
	if((type === 'percent' && (!Number.isFinite(value) || value <= 0 || value > 100))
		|| (type === 'fixed' && (!Number.isFinite(value) || value <= 0 || value > 100000))){
		setStatus(type === 'percent'
			? 'Enter a percentage from 0.01 to 100.'
			: 'Enter a discount between ৳0.01 and ৳100,000.', 'error');
		valueInput.focus();
		return;
	}

	saveButton.disabled = true;
	setStatus('Saving promo code...');
	try{
		const reference = doc(db,'promotions',code);
		const existing = await getDoc(reference);
		if(existing.exists()){
			setStatus(`Promo code ${code} already exists. Delete it first to replace it.`, 'error');
			return;
		}
		await setDoc(reference,{
			code,
			type,
			value:type === 'free_delivery' ? 0 : value,
			active:true,
			createdAt:serverTimestamp()
		});
		form.reset();
		updateValueField();
		setStatus(`Promo code ${code} saved.`, 'success');
	}catch(error){
		console.error('Could not save promo code:',error);
		setStatus(`Could not save promo code: ${error.message}`, 'error');
	}finally{
		saveButton.disabled = false;
	}
});

updateValueField();
if(!db){
	setStatus('Firebase Firestore is not connected. Promo codes cannot be loaded or saved.', 'error');
}else{
	onSnapshot(collection(db,'promotions'),renderPromos,error=>{
		console.error('Could not load promo codes:',error);
		setStatus(`Could not load promo codes: ${error.message}`, 'error');
	});
}
