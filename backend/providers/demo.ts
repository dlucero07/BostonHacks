import type {Location,Place,Point,JourneyInput,Route} from '../../shared/schema.js';
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
export class DemoProvider implements Provider {
 async route(input:JourneyInput,stop?:Place):Promise<Route>{const a=resolve(input.origin),b=resolve(input.destination);const walk=input.mode==='WALK';const baseDistance=distance(a,b)*1.18;const detours=[180,120,300,240,660,420];const extra=stop?(detours[demoPlaces.findIndex(p=>p.id===stop.id)]??360)*(walk?1:.65):0;const path:Point[]=stop?[a,{lat:(a.lat+stop.point.lat)/2,lng:(a.lng+stop.point.lng)/2},stop.point,{lat:(stop.point.lat+b.lat)/2,lng:(stop.point.lng+b.lng)/2},b]:[a,{lat:a.lat+.0015,lng:a.lng+(b.lng-a.lng)*.28},{lat:a.lat+.002,lng:a.lng+(b.lng-a.lng)*.65},b];return {durationSeconds:Math.round(baseDistance/(walk?1.35:6)+extra),distanceMeters:Math.round(baseDistance+extra*(walk?1.2:4)),path,simulated:true};}
 async search(){return demoPlaces;}
 async details(id:string){const place=demoPlaces.find(p=>p.id===id);if(!place)throw new AppError(404,'NOT_FOUND','That demo stop was not found.');return place;}
}
