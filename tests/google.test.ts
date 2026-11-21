import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {googleRequest,GoogleProvider,normalizeGooglePlace} from '../backend/providers/google.js';
import type {RouteSegment} from '../shared/schema.js';
const withoutEndpointLabels=(segments:RouteSegment[])=>segments.map(({startLabel,endLabel,...segment})=>segment);
import {filterSchema} from '../shared/schema.js';
test('Google place adapter preserves missing fields as unknown',()=>{const place=normalizeGooglePlace({id:'place-1',displayName:{text:'A cafe'},location:{latitude:42.35,longitude:-71.08},primaryType:'cafe'});assert.equal(place.rating,undefined);assert.equal(place.reviewCount,undefined);assert.equal(place.price,undefined);assert.equal(place.openNow,undefined);assert.equal(place.vegetarian,undefined);assert.equal(place.category,'cafe');});
test('Google REST quota and credential errors produce useful failures',async()=>{const stub=mock.method(globalThis,'fetch',async()=>new Response('{}',{status:429}));try{await assert.rejects(googleRequest('https://example.invalid','test',{},'id'),(e:unknown)=>e instanceof Error&&'code'in e&&e.code==='PROVIDER_QUOTA');stub.mock.mockImplementation(async()=>new Response('{}',{status:403}));await assert.rejects(googleRequest('https://example.invalid','test',{},'id'),/credentials/);}finally{stub.mock.restore();}});
test('Google place search deduplicated later; invalid or outside-Boston geometry is omitted',async()=>{let sentBody:Record<string,unknown>={};let sentMask='';const stub=mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{sentBody=JSON.parse(init?.body as string);sentMask=(init?.headers as Record<string,string>)['X-Goog-FieldMask'];return new Response(JSON.stringify({places:[{id:'a',location:{latitude:42.35,longitude:-71.08}},{id:'b',location:{latitude:10,longitude:20}},{id:'bad'}]}));});try{const result=await new GoogleProvider('test').search({origin:{label:'Boston University'},destination:{label:'Boston Common'},mode:'WALK'},{durationSeconds:100,distanceMeters:100,path:[],encodedPolyline:'test-polyline',simulated:false},filterSchema.parse({}));assert.equal(result.length,1);assert.deepEqual(sentBody.searchAlongRouteParameters,{polyline:{encodedPolyline:'test-polyline'}});assert.equal(sentBody.pageSize,20);assert(!sentMask.includes('servesVegetarianFood'));}finally{stub.mock.restore();}});
test('Google route missing fields yields NO_ROUTE rather than made-up times',async()=>{const stub=mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({routes:[{distanceMeters:10}]})));try{await assert.rejects(new GoogleProvider('test').route({origin:{label:'Boston University'},destination:{label:'Boston Common'},mode:'WALK'}),/No usable route/);}finally{stub.mock.restore();}});

test('train and bus use transit preferences; food stops route sequential legs at the arrival time',async()=>{
 const encode=(values:number[])=>{let result='';for(let value of values){value=value<0?~(value<<1):value<<1;while(value>=32){result+=String.fromCharCode((32|(value&31))+63);value>>=5;}result+=String.fromCharCode(value+63);}return result;};
 const polyline=encode([4235000,-7108000,100,100]);const bodies:Record<string,any>[]=[];
 const stub=mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{bodies.push(JSON.parse(init?.body as string));return new Response(JSON.stringify({routes:[{duration:'120s',distanceMeters:800,polyline:{encodedPolyline:polyline}}]}));});
 try{const provider=new GoogleProvider('test');const input={origin:{label:'Boston University'},destination:{label:'Boston Common'},mode:'TRAIN' as const,departureTime:'2026-11-21T15:00:00.000Z'};
 const route=await provider.route(input,{id:'stop',name:'Cafe',point:{lat:42.351,lng:-71.079},category:'cafe',categoryLabel:'Cafe'});
 assert.equal(route.durationSeconds,240);assert.equal(route.distanceMeters,1600);assert.equal(route.path.length,4);assert.equal(bodies.length,2);assert.equal(bodies[0].travelMode,'TRANSIT');assert.deepEqual(bodies[0].transitPreferences,{allowedTravelModes:['RAIL']});assert.equal(bodies[0].intermediates,undefined);assert.equal(bodies[1].departureTime,'2026-11-21T15:02:00.000Z');assert.deepEqual(bodies[0].destination,bodies[1].origin);
 await provider.route({...input,mode:'BUS'});assert.deepEqual(bodies[2].transitPreferences,{allowedTravelModes:['BUS']});
 }finally{stub.mock.restore();}
});

test('Google details excludes the disabled vegetarian billing field',async()=>{
 let mask='';const stub=mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{mask=(init?.headers as Record<string,string>)['X-Goog-FieldMask'];return new Response(JSON.stringify({id:'a',location:{latitude:42.35,longitude:-71.08}}));});
 try{await new GoogleProvider('test').details('a');assert(!mask.includes('servesVegetarianFood'));assert(mask.includes('rating'));}finally{stub.mock.restore();}
});

test('route steps preserve walking geometry and each transit line color across food stops',async()=>{
 const polyline='onnaG~xypL'; // 42.35, -71.08
 const steps=[
 {travelMode:'WALK',polyline:{encodedPolyline:polyline}},
 {travelMode:'TRANSIT',polyline:{encodedPolyline:polyline},transitDetails:{transitLine:{name:'Green Line',color:'#00843d'}}},
 {travelMode:'WALK',polyline:{encodedPolyline:polyline}},
 {travelMode:'TRANSIT',polyline:{encodedPolyline:polyline},transitDetails:{transitLine:{name:'Orange Line',color:'#ed8b00'}}}
 ];let mask='';
 const stub=mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{mask=(init?.headers as Record<string,string>)['X-Goog-FieldMask'];return new Response(JSON.stringify({routes:[{duration:'120s',distanceMeters:800,polyline:{encodedPolyline:polyline},legs:[{steps}]}]}));});
 try{const provider=new GoogleProvider('test');const input={origin:{label:'Boston University'},destination:{label:'Boston Common'},mode:'TRAIN' as const};
 const route=await provider.route(input);assert.deepEqual(route.segments?.map(s=>s.travelMode),['WALK','TRANSIT','WALK','TRANSIT']);assert.equal(route.segments?.[1].color,'#00843d');assert.equal(route.segments?.[3].color,'#ed8b00');assert.equal(route.segments?.[1].lineName,'Green Line');assert.deepEqual(route.segments?.[0].path,[{lat:42.35,lng:-71.08}]);assert(mask.includes('routes.legs.steps.travelMode'));assert(mask.includes('routes.legs.steps.transitDetails.transitLine'));
 const withStop=await provider.route(input,{id:'stop',name:'Cafe',point:{lat:42.351,lng:-71.079},category:'cafe',categoryLabel:'Cafe'});assert.deepEqual(withoutEndpointLabels(withStop.segments!),withoutEndpointLabels([...route.segments!,...route.segments!]));assert.equal(withStop.segments?.[3].endLabel,'Cafe');assert.equal(withStop.segments?.[4].startLabel,'Cafe');
 }finally{stub.mock.restore();}
});

test('multiple Google stops preserve waypoint order and transit arrival times across all legs',async()=>{
 const bodies:Record<string,any>[]=[];const polyline='onnaG~xypL';const stops=[{id:'one',name:'First cafe',point:{lat:42.351,lng:-71.079},category:'cafe' as const,categoryLabel:'Cafe'},{id:'two',name:'Second cafe',point:{lat:42.352,lng:-71.077},category:'cafe' as const,categoryLabel:'Cafe'}];
 const stub=mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{bodies.push(JSON.parse(init?.body as string));return new Response(JSON.stringify({routes:[{duration:'120s',distanceMeters:800,polyline:{encodedPolyline:polyline}}]}));});
 try{const provider=new GoogleProvider('test');const input={origin:{label:'Boston University'},destination:{label:'Boston Common'},mode:'WALK' as const,departureTime:'2026-11-21T15:00:00.000Z'};
 for(const mode of ['WALK','DRIVE'] as const){bodies.length=0;await provider.route({...input,mode},stops[0],stops.slice(1));assert.equal(bodies.length,1);assert.deepEqual(bodies[0].intermediates,stops.map(p=>({location:{latLng:{latitude:p.point.lat,longitude:p.point.lng}}})));assert.equal(bodies[0].destination.address,input.destination.label);}
 for(const mode of ['TRAIN','BUS'] as const){bodies.length=0;const route=await provider.route({...input,mode},stops[0],stops.slice(1));assert.equal(bodies.length,3);assert.equal(route.durationSeconds,360);assert.equal(route.distanceMeters,2400);assert.equal(route.segments?.length,3);assert.deepEqual(bodies.map(b=>b.departureTime),['2026-11-21T15:00:00.000Z','2026-11-21T15:02:00.000Z','2026-11-21T15:04:00.000Z']);for(let i=0;i<2;i++){assert.deepEqual(bodies[i].destination,bodies[i+1].origin);assert.equal(bodies[i].destination.location.latLng.latitude,stops[i].point.lat);}assert.equal(bodies[2].destination.address,input.destination.label);}
 }finally{stub.mock.restore();}
});

test('transit boarding and arrival stops, line direction and stop counts survive multi-stop routes',async()=>{
 const departureStop={name:'Kenmore',location:{latLng:{latitude:42.3489,longitude:-71.095}}};const arrivalStop={name:'Copley',location:{latLng:{latitude:42.35,longitude:-71.077}}};let mask='';
 const stub=mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{mask=(init?.headers as Record<string,string>)['X-Goog-FieldMask'];return new Response(JSON.stringify({routes:[{duration:'120s',distanceMeters:800,polyline:{encodedPolyline:'onnaG~xypL'},legs:[{steps:[{travelMode:'TRANSIT',polyline:{encodedPolyline:'onnaG~xypL'},transitDetails:{stopDetails:{departureStop,arrivalStop},stopCount:3,headsign:'Government Center',transitLine:{name:'Green Line B',nameShort:'B',color:'#00843d',vehicle:{type:'TRAM'}}}}]}]}]}));});
 try{const provider=new GoogleProvider('test');const input={origin:{label:'Boston University'},destination:{label:'Boston Common'},mode:'TRAIN' as const};const route=await provider.route(input);const segment=route.segments![0];assert.deepEqual(segment.departureStop,{name:'Kenmore',point:{lat:42.3489,lng:-71.095}});assert.deepEqual(segment.arrivalStop,{name:'Copley',point:{lat:42.35,lng:-71.077}});assert.equal(segment.stopCount,3);assert.equal(segment.headsign,'Government Center');assert.equal(segment.vehicleType,'TRAM');assert.equal(segment.lineName,'B');assert(mask.includes('transitDetails.stopDetails'));assert(mask.includes('transitDetails.stopCount'));
 const combined=await provider.route(input,{id:'food',name:'Cafe',point:{lat:42.35,lng:-71.08},category:'cafe',categoryLabel:'Cafe'});assert.deepEqual(withoutEndpointLabels(combined.segments!),withoutEndpointLabels([segment,segment]));assert.equal(combined.segments?.[0].endLabel,'Cafe');assert.equal(combined.segments?.[1].startLabel,'Cafe');
 departureStop.location.latLng.latitude=10;const outside=await provider.route(input);assert.equal(outside.segments?.[0].departureStop,undefined);assert(outside.segments?.[0].arrivalStop);
 }finally{stub.mock.restore();}
});

test('no-service legs at the start, middle and end fall back to real walking routes without dropping geometry',async()=>{
 const encode=(points:{lat:number;lng:number}[])=>{let lat=0,lng=0,result='';for(const point of points){const nextLat=Math.round(point.lat*1e5),nextLng=Math.round(point.lng*1e5);for(let value of [nextLat-lat,nextLng-lng]){value=value<0?~(value<<1):value<<1;while(value>=32){result+=String.fromCharCode((32|(value&31))+63);value>>=5;}result+=String.fromCharCode(value+63);}lat=nextLat;lng=nextLng;}return result;};
 const points=[{lat:42.35,lng:-71.105},{lat:42.351,lng:-71.095},{lat:42.352,lng:-71.08},{lat:42.355,lng:-71.065}];const stops=points.slice(1,-1).map((point,i)=>({id:String(i),name:`Food ${i+1}`,point,category:'cafe' as const,categoryLabel:'Cafe'}));
 for(const mode of ['TRAIN','BUS'] as const)for(const missingLeg of [0,1,2])for(const emptySteps of [false,true]){const bodies:Record<string,any>[]=[];
 const stub=mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{const body=JSON.parse(init?.body as string);bodies.push(body);const origin=body.origin.location.latLng;const index=points.findIndex(p=>p.lat===origin.latitude&&p.lng===origin.longitude);const polyline=encode(points.slice(index,index+2));
 if(index===missingLeg&&body.travelMode==='TRANSIT'&&!emptySteps)return new Response(JSON.stringify({routes:[]}));
 const walking=body.travelMode==='WALK';return new Response(JSON.stringify({routes:[{duration:walking?'180s':'120s',distanceMeters:walking?240:800,polyline:{encodedPolyline:polyline},legs:[{steps:index===missingLeg&&!walking&&emptySteps?[]:[{travelMode:walking?'WALK':'TRANSIT',staticDuration:walking?'180s':'120s',distanceMeters:walking?240:800,polyline:{encodedPolyline:polyline}}]}]}]}));});
 try{const route=await new GoogleProvider('test').route({origin:{label:'Start',point:points[0]},destination:{label:'End',point:points[3]},mode,departureTime:'2026-11-21T15:00:00.000Z'},stops[0],stops.slice(1));
 assert.equal(route.durationSeconds,420);assert.equal(route.distanceMeters,1840);assert.equal(route.segments?.length,3);assert.equal(route.segments?.[missingLeg].travelMode,'WALK');assert.equal(route.segments?.[missingLeg].durationSeconds,180);assert.equal(bodies.filter(b=>b.travelMode==='WALK').length,1);
 for(let i=0;i<3;i++){assert.deepEqual(route.segments![i].path[0],points[i]);assert.deepEqual(route.segments![i].path.at(-1),points[i+1]);}
 const onward=bodies.find(b=>b.travelMode==='TRANSIT'&&b.origin.location.latLng.latitude===points[Math.min(missingLeg+1,2)].lat);if(missingLeg===0){assert(onward);assert.equal(onward.departureTime,'2026-11-21T15:03:00.000Z');}
 }finally{stub.mock.restore();}}
});

test('walking fallback does not hide Google authentication or quota failures',async()=>{
 for(const status of [403,429]){let calls=0;const stub=mock.method(globalThis,'fetch',async()=>{calls++;return new Response('{}',{status});});try{await assert.rejects(new GoogleProvider('test').route({origin:{label:'Start'},destination:{label:'End'},mode:'TRAIN'}));assert.equal(calls,1);}finally{stub.mock.restore();}}
});
