import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {watchLiveLocation,type LiveLocation} from '../frontend/src/live-location';
import {MapView} from '../frontend/src/Map';
function device(){
 let success:PositionCallback,error:PositionErrorCallback|null|undefined,options:PositionOptions|undefined;
 const cleared:number[]=[];
 const geolocation:Geolocation={getCurrentPosition:()=>{throw new Error('Unexpected one-shot location request');},watchPosition:(s:PositionCallback,e?:PositionErrorCallback|null,o?:PositionOptions)=>{success=s;error=e;options=o;return 0;},clearWatch:(id:number)=>{cleared.push(id);}};
 return {geolocation,cleared,get options(){return options;},position:(lat=42.35,lng=-71.08,timestamp=Date.now())=>success({coords:{latitude:lat,longitude:lng,accuracy:12},timestamp} as GeolocationPosition),fail:(code:number)=>error?.({code} as GeolocationPositionError)};
}
test('watch delivers moving positions, requests fresh high accuracy fixes, and ignores callbacks after cleanup',()=>{
 const gps=device(),locations:LiveLocation[]=[];
 const stop=watchLiveLocation(gps.geolocation,p=>locations.push(p),()=>assert.fail('unexpected location error'));
 gps.position();gps.position(42.351);assert.equal(locations.length,2);assert.equal(locations[1].point.lat,42.351);assert.equal(locations[0].accuracy,12);
 assert.deepEqual(gps.options,{enableHighAccuracy:true,timeout:15000,maximumAge:0});
 stop();assert.deepEqual(gps.cleared,[0]);gps.position();gps.fail(1);assert.equal(locations.length,2);
});
test('outside Boston positions stop tracking without becoming a route origin',()=>{
 const gps=device(),errors:string[]=[];let updates=0;
 watchLiveLocation(gps.geolocation,()=>updates++,message=>errors.push(message));
 gps.position(40.7,-74);gps.position();assert.equal(updates,0);assert.deepEqual(gps.cleared,[0]);assert.match(errors[0],/Boston/);
});
test('permission, timeout and unavailable errors stop tracking and explain recovery',()=>{
 for(const [code,message] of [[1,/permission was denied/],[2,/unavailable/],[3,/timed out/]] as const){
  const gps=device(),errors:string[]=[];
  watchLiveLocation(gps.geolocation,()=>assert.fail('unexpected position'),e=>errors.push(e));gps.fail(code);if(code!==1)gps.fail(code);gps.fail(code);
  assert.equal(errors.length,1);assert.match(errors[0],message);assert.deepEqual(gps.cleared,code===1?[0]:[0,0]);
 }
});
test('stale and invalid fixes cannot be shown as live',()=>{
 const gps=device();let updates=0;
 watchLiveLocation(gps.geolocation,()=>updates++,()=>{});gps.position(42.35,-71.08,Date.now()-60000);assert.equal(updates,0);gps.position();assert.equal(updates,1);
});
test('demo map displays a real location with accuracy or explains when it is beyond the illustration',()=>{
 const props={config:{mode:'demo' as const},places:[],stops:[],onSelect:()=>{}};
 const html=renderToStaticMarkup(createElement(MapView,{...props,liveLocation:{point:{lat:42.35,lng:-71.08},accuracy:12,timestamp:Date.now()}}));
 assert.match(html,/Your live location/);assert.match(html,/accuracy ±12 m/);assert.match(html,/shaded area = accuracy/);
 const outside=renderToStaticMarkup(createElement(MapView,{...props,liveLocation:{point:{lat:42.4,lng:-71.2},accuracy:12,timestamp:Date.now()}}));assert.match(outside,/outside this illustrated map/);
 const off=renderToStaticMarkup(createElement(MapView,props));assert.doesNotMatch(off,/Your live location/);
});
test('demo map zoom controls use viewBox zooming and allow zoom-in from the default level',()=>{
 const html=renderToStaticMarkup(createElement(MapView,{config:{mode:'demo' as const},places:[],stops:[],onSelect:()=>{}}));
 assert.match(html,/viewBox="0 0 1000 800"/);
 assert.match(html,/aria-label="Zoom in"/);
 assert.match(html,/aria-label="Zoom out"/);
 assert.doesNotMatch(html,/scale\(/);
 assert.doesNotMatch(html,/aria-label="Zoom in"[^>]*disabled/);
});

test('unavailable high-accuracy location retries with a general fix and ignores the abandoned watch',()=>{
 const positions:PositionCallback[]=[],errors:(PositionErrorCallback|null|undefined)[]=[],options:(PositionOptions|undefined)[]=[],cleared:number[]=[];
 const gps:Geolocation={getCurrentPosition:()=>assert.fail('unexpected one-shot request'),watchPosition:(success,error,option)=>{positions.push(success);errors.push(error);options.push(option);return positions.length-1;},clearWatch:id=>{cleared.push(id);}};
 const locations:LiveLocation[]=[];const stop=watchLiveLocation(gps,p=>locations.push(p),()=>assert.fail('unexpected terminal error'));
 errors[0]?.({code:2} as GeolocationPositionError);assert.equal(options[1]?.enableHighAccuracy,false);assert.deepEqual(cleared,[0]);
 const position={coords:{latitude:42.35,longitude:-71.08,accuracy:80},timestamp:Date.now()} as GeolocationPosition;
 positions[0](position);assert.equal(locations.length,0);errors[0]?.({code:1} as GeolocationPositionError);positions[1](position);assert.equal(locations.length,1);
 stop();assert.deepEqual(cleared,[0,1]);positions[1](position);assert.equal(locations.length,1);
});

test('GPS drift does not block stops, while edited route inputs still require replanning',async()=>{
 const {journeyDraftChanged}=await import('../frontend/src/journey-draft');
 const origin={label:'My current location',point:{lat:42.35,lng:-71.08}};
 const planned={origin,destination:{label:'Boston Common',point:{lat:42.355,lng:-71.065}},mode:'WALK' as const};
 const moving={...planned,origin:{...origin,point:{lat:42.3501,lng:-71.0801}}};
 assert.equal(journeyDraftChanged(moving,planned),false);
 assert.equal(journeyDraftChanged({...moving,mode:'DRIVE'},planned),true);
 assert.equal(journeyDraftChanged({...moving,destination:{...planned.destination,point:{lat:42.356,lng:-71.065}}},planned),true);
 assert.equal(journeyDraftChanged({...moving,origin:{label:'Boston University'}},planned),true);
 assert.equal(journeyDraftChanged(moving,{...planned,origin:{label:'Boston University'}}),true);
 const manual={...planned,origin:{label:'Chosen address',point:origin.point,placeId:'place-a'}};
 assert.equal(journeyDraftChanged({...manual,origin:{...manual.origin,point:moving.origin.point}},manual),true);
 assert.equal(journeyDraftChanged({...manual,origin:{...manual.origin,placeId:'place-b'}},manual),true);
});
