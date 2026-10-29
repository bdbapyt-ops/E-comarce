import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalogSelectionKey, getCatalogSelectionLabel, getCatalogUnitPrice, getCatalogWeightOptions } from '../shared/catalog-options.js';
import { getDeliveryCharge } from '../shared/delivery-pricing.js';
import { getFirebaseWebConfig } from '../server/firebase-web-config.js';

test('size choices stay separate in the cart',()=>{
	assert.notEqual(getCatalogSelectionKey({type:'size',value:'M'}),getCatalogSelectionKey({type:'size',value:'XL'}));
	assert.equal(getCatalogSelectionKey({type:'size',value:' 42 '}),'size:42');
	assert.equal(getCatalogSelectionKey({type:'size',value:' 42 '}),getCatalogSelectionKey({type:'size',value:'42'}));
	assert.equal(getCatalogSelectionLabel({type:'size',value:'42'},true),'সাইজ: 42');
});

test('weight price uses the per-kilogram rate and converts milligrams',()=>{
	assert.equal(getCatalogUnitPrice({price:1000,selection:{type:'weight',amount:0.5,unit:'KG'}}),500);
	assert.equal(getCatalogUnitPrice({price:1000,selection:{type:'weight',amount:500000,unit:'MG'}}),500);
	assert.equal(getCatalogUnitPrice({price:1000,selection:{type:'weight',amount:500,unit:'G'}}),500);
	assert.notEqual(getCatalogSelectionKey({type:'weight',amount:0.5,unit:'KG'}),getCatalogSelectionKey({type:'weight',amount:500,unit:'MG'}));
});

test('admin weight options accept valid amount and unit pairs only',()=>{
	assert.deepEqual(getCatalogWeightOptions({weightOptions:[
		{amount:250,unit:'G'},
		{amount:0.25,unit:'KG'},
		{amount:250,unit:'G'},
		{amount:0,unit:'KG'},
		{amount:500,unit:'OUNCE'}
	]}),[
		{amount:250,unit:'G'},
		{amount:0.25,unit:'KG'}
	]);
});

test('delivery charge uses the Dhaka rate only for Dhaka district',()=>{
	const settings = {deliveryChargeDhaka:60,deliveryChargeOutside:120};
	assert.equal(getDeliveryCharge(settings,{id:'13',en:'Dhaka',bn:'ঢাকা'}),60);
	assert.equal(getDeliveryCharge(settings,{id:'1',en:'Bagerhat',bn:'বাগেরহাট'}),120);
	assert.equal(getDeliveryCharge(settings,null),0);
	assert.equal(getDeliveryCharge({deliveryChargeDhaka:-1,deliveryChargeOutside:'invalid'},{en:'Dhaka'}),0);
});

test('discount applies before converting the selected weight',()=>{
	assert.equal(getCatalogUnitPrice({price:1000,discount:10,selection:{type:'weight',amount:500,unit:'MG'}}),0.45);
});

test('invalid options do not become distinct variants or override base price',()=>{
	assert.equal(getCatalogSelectionKey({type:'size',value:'X'.repeat(31)}),'none');
	assert.equal(getCatalogSelectionKey({type:'weight',amount:-2,unit:'KG'}),'none');
	assert.equal(getCatalogUnitPrice({price:100,selection:{type:'weight',amount:-2,unit:'KG'}}),100);
	assert.equal(getCatalogSelectionLabel({type:'weight',amount:500,unit:'MG'},true),'ওজন: 500 MG');
});

test('Firebase Analytics measurement ID is optional',()=>{
	const config = getFirebaseWebConfig({
		FIREBASE_API_KEY:'api-key',
		FIREBASE_AUTH_DOMAIN:'example.firebaseapp.com',
		FIREBASE_PROJECT_ID:'example',
		FIREBASE_STORAGE_BUCKET:'example.appspot.com',
		FIREBASE_MESSAGING_SENDER_ID:'123',
		FIREBASE_APP_ID:'1:123:web:abc'
	});
	assert.equal('measurementId' in config,false);
});

test('Firebase Analytics measurement ID is included when configured',()=>{
	const config = getFirebaseWebConfig({
		FIREBASE_API_KEY:'api-key',
		FIREBASE_AUTH_DOMAIN:'example.firebaseapp.com',
		FIREBASE_PROJECT_ID:'example',
		FIREBASE_STORAGE_BUCKET:'example.appspot.com',
		FIREBASE_MESSAGING_SENDER_ID:'123',
		FIREBASE_APP_ID:'1:123:web:abc',
		FIREBASE_MEASUREMENT_ID:'G-ABC123'
	});
	assert.equal(config.measurementId,'G-ABC123');
});
