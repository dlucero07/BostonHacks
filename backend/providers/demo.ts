import type {Location,Place,Point,JourneyInput,Route,RouteSegment} from '../../shared/schema.js';
import type {Provider} from './types.js';
import {AppError} from './types.js';
export const demoLocations:Location[]=[
 {label:'Boston University',point:{lat:42.3505,lng:-71.1054}},
 {label:'Boston Common',point:{lat:42.355,lng:-71.0656}},
 {label:'Copley Square',point:{lat:42.3493,lng:-71.077}},
 {label:'Fenway Park',point:{lat:42.3467,lng:-71.0972}},
 {label:'Back Bay Station',point:{lat:42.3473,lng:-71.0755}},
 {label:'Northeastern University',point:{lat:42.3398,lng:-71.0892}}
];
export const demoPlaces:Place[]=[
 {id:'demo-1',name:'Little Green Kitchen',category:'restaurant',categoryLabel:'Mediterranean · bowls',point:{lat:42.3505,lng:-71.0885},rating:4.8,reviewCount:426,price:1,openNow:true,vegetarian:true,address:'Fictional stop · Back Bay'},
 {id:'demo-2',name:'Common Ground Coffee',category:'cafe',categoryLabel:'Coffee · light bites',point:{lat:42.3534,lng:-71.0744},rating:4.7,reviewCount:218,price:1,openNow:true,vegetarian:true,address:'Fictional stop · Commonwealth Avenue'},
 {id:'demo-3',name:'The Noodle Corner',category:'restaurant',categoryLabel:'Asian · noodles',point:{lat:42.3487,lng:-71.0835},rating:4.6,reviewCount:682,price:2,openNow:true,vegetarian:false,address:'Fictional stop · Newbury Street'},
 {id:'demo-4',name:'Butter & Crumb',category:'bakery',categoryLabel:'Bakery · pastries',point:{lat:42.3513,lng:-71.095},rating:4.9,reviewCount:84,price:2,openNow:false,vegetarian:true,address:'Fictional stop · Kenmore'},
 {id:'demo-5',name:'Citrus Table',category:'restaurant',categoryLabel:'Seasonal · vegetarian',point:{lat:42.3469,lng:-71.078},rating:4.5,reviewCount:307,price:3,openNow:true,vegetarian:true,address:'Fictional stop · Copley'},
 {id:'demo-6',name:'Parkside Pizza Club',category:'restaurant',categoryLabel:'Italian · pizza',point:{lat:42.3525,lng:-71.0688},rating:4.6,reviewCount:511,price:2,openNow:true,address:'Fictional stop · Public Garden'}
];
function resolve(l:Location):Point {if(l.point)return l.point;const found=demoLocations.find(x=>x.label.toLowerCase()===l.label.toLowerCase());if(!found?.point)throw new AppError(400,'DEMO_LOCATION','Choose one of the six demo locations. Live mode supports other Boston addresses.');return found.point;}
function distance(a:Point,b:Point){return Math.hypot((a.lat-b.lat)*111000,(a.lng-b.lng)*82200);}
// Simulated transit includes walking to and from each ride, including food stops.
function demoSegments(path:Point[],mode:JourneyInput['mode'],stopCount:number):RouteSegment[]{
 if(mode==='WALK'||mode==='DRIVE')return [{path,travelMode:mode}];
 const legs=stopCount?Array.from({length:stopCount+1},(_,i)=>path.slice(i*2,i*2+3)):[path];
 const between=(a:Point,b:Point,t:number):Point=>({lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t});
 return legs.flatMap((leg,i)=>{const start=leg[0],end=leg.at(-1)!,board=between(start,leg[1],.3),alight=between(leg.at(-2)!,end,.7);return [
 {path:[start,board],travelMode:'WALK' as const},
 {path:[board,...leg.slice(1,-1),alight],travelMode:'TRANSIT' as const,departureStop:{name:`Demo ${mode==='TRAIN'?'station':'bus stop'} ${i*2+1}`,point:board},arrivalStop:{name:`Demo ${mode==='TRAIN'?'station':'bus stop'} ${i*2+2}`,point:alight},vehicleType:mode==='BUS'?'BUS':'SUBWAY',...(mode==='TRAIN'?{color:'#00843d',lineName:'Green Line'}:{lineName:'Demo bus'})},
 {path:[alight,end],travelMode:'WALK' as const}
 ];});
}
export class DemoProvider implements Provider {
 async route(input:JourneyInput,stop?:Place,additionalStops:Place[]=[]):Promise<Route>{const a=resolve(input.origin),b=resolve(input.destination);const walk=input.mode==='WALK';const speed={WALK:1.35,DRIVE:6,TRAIN:8,BUS:4}[input.mode];const wait=input.mode==='TRAIN'?240:input.mode==='BUS'?180:0;const baseDistance=distance(a,b)*1.18;const detours=[180,120,300,240,660,420];const stops=stop?[stop,...additionalStops]:[];const extra=stops.reduce((sum,p)=>sum+(detours[demoPlaces.findIndex(d=>d.id===p.id)]??360)*(walk?1:.65),0);const points=[a,...stops.map(p=>p.point),b];const path:Point[]=stops.length?points.flatMap((p,i)=>i?[{lat:(points[i-1].lat+p.lat)/2,lng:(points[i-1].lng+p.lng)/2},p]:[p]):[a,{lat:a.lat+(input.mode==='DRIVE'?.0008:input.mode==='TRAIN'?.0025:input.mode==='BUS'?.0012:.0015),lng:a.lng+(b.lng-a.lng)*.28},{lat:a.lat+(input.mode==='DRIVE'?.001:input.mode==='TRAIN'?.003:input.mode==='BUS'?.0015:.002),lng:a.lng+(b.lng-a.lng)*.65},b];return {segments:demoSegments(path,input.mode,stops.length),durationSeconds:Math.round(baseDistance/speed+wait+extra),distanceMeters:Math.round(baseDistance+extra*(walk?1.2:4)),path,simulated:true};}
 async search(){return demoPlaces;}
 async details(id:string){const place=demoPlaces.find(p=>p.id===id);if(!place)throw new AppError(404,'NOT_FOUND','That demo stop was not found.');return place;}
}
