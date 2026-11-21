import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {googleRequest,GoogleProvider,normalizeGooglePlace} from '../backend/providers/google.js';
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
 const withStop=await provider.route(input,{id:'stop',name:'Cafe',point:{lat:42.351,lng:-71.079},category:'cafe',categoryLabel:'Cafe'});assert.deepEqual(withStop.segments,[...route.segments!,...route.segments!]);
 }finally{stub.mock.restore();}
});
