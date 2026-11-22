import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {placeLogoUrl,fallbackLogo,useFallbackLogo} from '../frontend/src/place-logo.js';
import {PlaceLogo} from '../frontend/src/PlaceLogo.js';
import {MapView} from '../frontend/src/Map.js';
import {normalizeGooglePlace} from '../backend/providers/google.js';
import type {Recommendation} from '../shared/schema.js';

test('company icons use only the website hostname and reject unsupported URLs',()=>{
 const url=new URL(placeLogoUrl({websiteUri:'https://user:secret@www.cafe.example/menu?token=private#section'})!);
 assert.equal(url.origin,'https://www.google.com');assert.equal(url.searchParams.get('domain'),'www.cafe.example');assert.equal(url.searchParams.get('sz'),'128');
 for(const websiteUri of [undefined,'','not a URL','javascript:alert(1)','file:///etc/hosts','data:image/png;base64,a'])assert.equal(placeLogoUrl({websiteUri}),undefined);
});
test('missing icons render the local on-the-go mark and broken icons fall back without looping',()=>{
 const html=renderToStaticMarkup(createElement(PlaceLogo,{place:{}}));assert(html.includes(`src="${fallbackLogo}"`));
 let src=placeLogoUrl({websiteUri:'https://cafe.example'})!,writes=0;
 const image={getAttribute:()=>src,set src(value:string){src=value;writes++;}} as unknown as HTMLImageElement;
 useFallbackLogo(image);assert.equal(src,fallbackLogo);useFallbackLogo(image);assert.equal(writes,1);
});
test('website data is optional and malformed website metadata does not discard a restaurant',()=>{
 const raw={id:'cafe',displayName:{text:'Cafe'},location:{latitude:42.35,longitude:-71.08}};
 assert.equal(normalizeGooglePlace({...raw,websiteUri:'https://cafe.example/menu'}).websiteUri,'https://cafe.example/menu');
 assert.equal(normalizeGooglePlace({...raw,websiteUri:'not a URL'}).websiteUri,undefined);
 assert.equal(normalizeGooglePlace(raw).websiteUri,undefined);
});
test('demo map renders company images, fallback marks, and accessible restaurant names',()=>{
 const base:Recommendation={id:'cafe',name:'Cafe',websiteUri:'https://cafe.example',point:{lat:42.35,lng:-71.08},category:'cafe',categoryLabel:'Cafe',extraSeconds:60,popularity:.8,score:.8,reason:'Nearby',route:{durationSeconds:120,distanceMeters:100,path:[],simulated:true}};
 const html=renderToStaticMarkup(createElement(MapView,{config:{mode:'demo'},places:[base,{...base,id:'unknown',name:'No logo',websiteUri:undefined}],stops:[base],selected:base.id,onSelect:()=>{}}));
 assert(html.includes('domain=cafe.example'));assert(html.includes(fallbackLogo));assert(html.includes('Select Cafe, 1 minutes added, added to route'));assert(html.includes('Select No logo'));assert(!html.includes('Letters match'));
});
