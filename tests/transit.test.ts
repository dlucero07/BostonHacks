import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transitMarkers} from '../shared/transit.js';
import type {RouteSegment} from '../shared/schema.js';
import {TransitDirections} from '../frontend/src/TransitDirections.js';
import {DemoProvider} from '../backend/providers/demo.js';
const kenmore={name:'Kenmore',point:{lat:42.3489,lng:-71.095}};
const copley={name:'Copley',point:{lat:42.35,lng:-71.077}};
const park={name:'Park Street',point:{lat:42.356,lng:-71.062}};
const segments:RouteSegment[]=[{path:[kenmore.point,copley.point],travelMode:'TRANSIT',lineName:'Green Line',color:'#00843d',departureStop:kenmore,arrivalStop:copley,headsign:'Government Center',stopCount:3,vehicleType:'TRAM'},{path:[copley.point,park.point],travelMode:'TRANSIT',lineName:'39',departureStop:copley,arrivalStop:park,vehicleType:'BUS'}];
test('transit markers label boarding, transfers and arrival without duplicating a station',()=>{
 const markers=transitMarkers(segments);assert.equal(markers.length,3);assert.equal(markers[0].label,'Board: Kenmore');assert.equal(markers[1].label,'Transfer: Copley');assert.equal(markers[1].description,'Green Line · 39');assert.equal(markers[2].label,'Get off: Park Street');assert.deepEqual(transitMarkers([{path:[],travelMode:'WALK'}]),[]);
});
test('transit directions show stop names, line direction and counts and tolerate missing data',()=>{
 const html=renderToStaticMarkup(createElement(TransitDirections,{route:{segments,durationSeconds:100,distanceMeters:500,path:[],simulated:false}}));for(const label of ['Kenmore','Copley','Park Street','Government Center','Green Line','3 stops','Board','Get off'])assert(html.includes(label));
 assert.equal(renderToStaticMarkup(createElement(TransitDirections,{})),'');
 const fallback=renderToStaticMarkup(createElement(TransitDirections,{route:{segments:[{path:[],travelMode:'TRANSIT',vehicleType:'BUS'}],durationSeconds:100,distanceMeters:500,path:[],simulated:false}}));assert(fallback.includes('Bus'));assert(fallback.includes('Boarding stop unavailable'));
});
test('demo train and bus stops match ride endpoints and walking connections',async()=>{
 for(const mode of ['TRAIN','BUS'] as const){const route=await new DemoProvider().route({origin:{label:'Boston University'},destination:{label:'Boston Common'},mode});const [walk,ride,onward]=route.segments!;assert.deepEqual(ride.departureStop?.point,ride.path[0]);assert.deepEqual(ride.arrivalStop?.point,ride.path.at(-1));assert.deepEqual(walk.path.at(-1),ride.departureStop?.point);assert.deepEqual(onward.path[0],ride.arrivalStop?.point);assert.equal(ride.vehicleType,mode==='BUS'?'BUS':'SUBWAY');}
});

test('walking instructions and map labels preserve walks before, between and after food stops',async()=>{
 const {walkingMarkers,routeSteps,walkingColor,segmentColor}=await import('../shared/transit.js');
 const walk=(startLabel?:string,endLabel?:string)=>({path:[kenmore.point,copley.point],travelMode:'WALK' as const,durationSeconds:60,distanceMeters:80,startLabel,endLabel});
 const segments=[walk('Start','First cafe'),walk('First cafe'),walk(undefined,'Second cafe'),{...segmentsForRide()},walk(undefined,'Destination')];
 function segmentsForRide(){return {path:[copley.point,park.point],travelMode:'TRANSIT' as const,departureStop:copley,arrivalStop:park};}
 const steps=routeSteps(segments);assert.equal(steps.length,4);assert.equal(steps[1].durationSeconds,120);assert.equal(steps[1].endLabel,'Second cafe');assert.equal(walkingMarkers(segments).length,3);assert.equal(segmentColor(segments[0]),walkingColor);
 const html=renderToStaticMarkup(createElement(TransitDirections,{route:{segments,durationSeconds:300,distanceMeters:500,path:[],simulated:false}}));for(const text of ['Walk 1 min','Walk 2 min','First cafe','Second cafe','Destination','160'])assert(html.includes(text));assert.equal(segments[1].path.length,2);
});
