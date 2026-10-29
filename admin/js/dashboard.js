import { db } from '../../shared/firebase.js?v=2';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

const categoriesElement = document.getElementById('categories');
const itemsElement = document.getElementById('items');
function showLoadError(element,message,error){
	console.error(message,error);
	element.textContent = '—';
}

if(!db){
	showLoadError(categoriesElement,'Dashboard could not connect to Firestore.');
	showLoadError(itemsElement,'Dashboard could not connect to Firestore.');
}else{
	onSnapshot(collection(db,'categories'),snapshot=>{
		categoriesElement.textContent = snapshot.size.toLocaleString('en-BD');
	},error=>showLoadError(categoriesElement,'Could not load category count:',error));

	onSnapshot(collection(db,'items'),snapshot=>{
		itemsElement.textContent = snapshot.size.toLocaleString('en-BD');
	},error=>showLoadError(itemsElement,'Could not load item count:',error));
}
