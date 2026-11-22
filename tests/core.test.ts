import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {extraTravelSeconds,popularity,markerSize,matches,enforceDetour} from '../shared/domain.js';
import {filterSchema,journeySchema,type Place} from '../shared/schema.js';
import {MemoryInteractionStore} from '../backend/storage.js';
import {DemoProvider,demoPlaces} from '../backend/providers/demo.js';
import {JourneyService} from '../backend/service.js';
import {AppError} from '../backend/providers/types.js';
import {createApp} from '../backend/app.js';
import {journeyDraftChanged} from '../frontend/src/journey-draft.js';
const input={origin:{label:'Boston University'},destination:{label:'Boston Common'},mode:'WALK' as const};
const filters=filterSchema.parse({});
test('rating defaults to three stars and search honors every threshold from zero to five',async()=>{
 assert.equal(filters.minRating,3);
 for(const minRating of [-1,5.1])assert.equal(filterSchema.safeParse({minRating}).success,false);
 const provider=new DemoProvider();
 const candidates=[undefined,0,1,2,2.9,3,3.9,4,4.5,5].map((rating,i)=>({...demoPlaces[0],id:`rating-${i}`,rating}));
 provider.search=async()=>candidates;
 const service=new JourneyService(provider,new MemoryInteractionStore());const journey=await service.create(input);
 for(const minRating of [0,1,2,3,4,4.5,5]){
  const result=await service.search(journey.id,filterSchema.parse({minRating}));
  assert.deepEqual(new Set(result.restaurants.map(p=>p.id)),new Set(candidates.filter(p=>minRating===0||p.rating!==undefined&&p.rating>=minRating).map(p=>p.id)));
 }
});
test('resolving typed addresses leaves food stops enabled, and edits require replanning',async()=>{
 for(const mode of ['WALK','DRIVE','TRAIN','BUS'] as const){
  const service=new JourneyService(new DemoProvider(),new MemoryInteractionStore());
  const draft={...input,mode};
  const planned=await service.create(draft);
  assert(planned.origin.point);assert(planned.destination.point);
  assert.equal(journeyDraftChanged(draft,planned),false);
  assert.equal(journeyDraftChanged({...draft,origin:{label:'Copley Square'}},planned),true);
  assert.equal(journeyDraftChanged({...draft,destination:{label:'Fenway Park'}},planned),true);
  assert.equal(journeyDraftChanged({...draft,mode:mode==='WALK'?'DRIVE':'WALK'},planned),true);
  const results=await service.search(planned.id,filters);
  const selected=results.restaurants[0];assert(selected);
  const added=await service.stops(planned.id,[selected.id]);
  assert(added.route.path.some(p=>p.lat===selected.point.lat&&p.lng===selected.point.lng));
  assert.deepEqual(await service.stops(planned.id,[]),{route:planned.baseline,extraSeconds:0});
 }
});
test('detour uses total stop-route duration minus comparable baseline',()=>{assert.equal(extraTravelSeconds(900,1080),180);assert.equal(extraTravelSeconds(900,890),0);assert.throws(()=>extraTravelSeconds(NaN,1));});
test('Bayesian prior prevents a single 5-star review dominating established quality',()=>{const base=demoPlaces[0];assert(popularity({...base,rating:5,reviewCount:1})<popularity({...base,rating:4.7,reviewCount:500}));for(const n of [0,1,50,1e9]){const score=popularity({...base,reviewCount:n},n);assert(score>=0&&score<=1);assert(markerSize(score)>=24&&markerSize(score)<=64);}});
test('missing place fields stay unknown and strict filters exclude unknowns',()=>{const place:Place={id:'unknown',name:'Unknown',point:{lat:42.35,lng:-71.08},category:'restaurant',categoryLabel:'Restaurant'};assert(!matches(place,filters));assert(matches(place,{...filters,minRating:0}));assert(!matches(place,{...filters,maxPrice:2}));assert(!matches(place,{...filters,minRating:4}));assert(Number.isFinite(popularity(place)));});
test('interactions deduplicate event types per session; popularity counts unique sessions',async()=>{const store=new MemoryInteractionStore();const sessionId=randomUUID();const e={placeId:'demo-1',eventType:'select' as const,sessionId};assert(await store.record(e));assert.equal(await store.record(e),false);await store.record({...e,eventType:'details'});assert.equal((await store.counts()).get('demo-1'),1);await store.record({...e,sessionId:randomUUID()});assert.equal((await store.counts()).get('demo-1'),2);});
test('complete simulated A → restaurant → B flow and enforced constraints',async()=>{const service=new JourneyService(new DemoProvider(),new MemoryInteractionStore());const j=await service.create(input);assert(j.baseline.simulated);const f={...filters,maxDetour:5 as const,maxPrice:1};const result=await service.search(j.id,f);assert(result.restaurants.length>0);for(const p of result.restaurants){assert(p.extraSeconds<=300);assert.equal(p.price,1);}const p=result.restaurants[0];const stop=await service.stop(j.id,p.id);assert.equal(stop.extraSeconds,stop.route.durationSeconds-j.baseline.durationSeconds);assert(stop.route.path.some(x=>x.lat===p.point.lat&&x.lng===p.point.lng));assert.equal(enforceDetour([{...p,extraSeconds:301,score:100}],f).length,0);});
test('provider failures never fabricate routes or stops',async()=>{const provider=new DemoProvider();provider.route=async()=>{throw new AppError(502,'PROVIDER_UNAVAILABLE','Provider down');};await assert.rejects(new JourneyService(provider,new MemoryInteractionStore()).create(input),/Provider down/);});
test('partial detour failures omit unroutable candidates and warn',async()=>{const base=new DemoProvider();const route=base.route.bind(base);base.route=async(i,stop)=>{if(stop?.id==='demo-1')throw new Error('route failure');return route(i,stop);};const service=new JourneyService(base,new MemoryInteractionStore());const j=await service.create(input);const r=await service.search(j.id,filters);assert(r.warning);assert(!r.restaurants.some(p=>p.id==='demo-1'));});
test('quota errors propagate and do not turn into fabricated empty results',async()=>{const base=new DemoProvider();const route=base.route.bind(base);base.route=async(i,stop)=>{if(stop)throw new AppError(429,'PROVIDER_QUOTA','Quota reached');return route(i);};const service=new JourneyService(base,new MemoryInteractionStore());const j=await service.create(input);await assert.rejects(service.search(j.id,filters),/Quota reached/);});
test('Boston boundary validation rejects out-of-area coordinates',()=>{assert(!journeySchema.safeParse({...input,origin:{label:'Elsewhere',point:{lat:10,lng:20}}}).success);});
test('HTTP contract validates requests and health, performs the complete demo journey',async()=>{const app=createApp(new DemoProvider(),new MemoryInteractionStore(),{mode:'demo'});const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('No address');const root=`http://127.0.0.1:${address.port}`;const post=(path:string,body:unknown)=>fetch(root+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});try{assert.equal((await fetch(root+'/api/health')).status,200);assert.equal((await post('/api/routes',{})).status,400);const j=await (await post('/api/routes',input)).json();const result=await (await post('/api/restaurants/search',{journeyId:j.id,filters})).json();assert(result.restaurants.length);const stop=await (await post('/api/routes/with-stop',{journeyId:j.id,placeId:result.restaurants[0].id})).json();assert(stop.route.durationSeconds>=j.baseline.durationSeconds);const config=await (await fetch(root+'/api/config')).json();assert.equal(config.browserKey,undefined);}finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}});

test('all four travel modes produce complete journeys and mode-specific demo estimates',async()=>{
 const durations=new Set<number>();for(const mode of ['WALK','DRIVE','TRAIN','BUS'] as const){const parsed=journeySchema.parse({...input,mode});const service=new JourneyService(new DemoProvider(),new MemoryInteractionStore());const journey=await service.create(parsed);assert.equal(journey.mode,mode);durations.add(journey.baseline.durationSeconds);const result=await service.search(journey.id,filters);assert(result.restaurants.length>0);const stop=await service.stop(journey.id,result.restaurants[0].id);assert(stop.route.durationSeconds>=journey.baseline.durationSeconds);}assert.equal(durations.size,4);
});

test('search shortlists and returns twenty food stops from thirty candidates',async()=>{
 const provider=new DemoProvider();const candidates=Array.from({length:30},(_,i)=>({...demoPlaces[0],id:`candidate-${i}`,reviewCount:i*100}));provider.search=async()=>candidates;
 const originalRoute=provider.route.bind(provider);let stopRoutes=0;provider.route=async(input,stop)=>{if(stop)stopRoutes++;return originalRoute(input,stop);};
 const service=new JourneyService(provider,new MemoryInteractionStore());const journey=await service.create(input);const result=await service.search(journey.id,filters);
 assert.equal(result.restaurants.length,20);assert.equal(stopRoutes,20);assert.deepEqual(new Set(result.restaurants.map(p=>p.id)),new Set(candidates.slice(10).map(p=>p.id)));assert(result.restaurants.every((p,i,list)=>i===0||list[i-1].score>=p.score));
 assert.equal('vegetarian' in filterSchema.parse({vegetarian:true}),false);
});

test('multiple stops route through every stop in order, with removal and baseline reset',async()=>{
 for(const mode of ['WALK','DRIVE','TRAIN','BUS'] as const){
 const service=new JourneyService(new DemoProvider(),new MemoryInteractionStore());const journey=await service.create({...input,mode});await service.search(journey.id,filters);
 const ids=['demo-1','demo-2','demo-3'];const result=await service.stops(journey.id,ids);let previous=-1;
 for(const id of ids){const p=demoPlaces.find(p=>p.id===id)!;const index=result.route.path.findIndex(x=>x.lat===p.point.lat&&x.lng===p.point.lng);assert(index>previous);previous=index;}
 assert.equal(result.extraSeconds,result.route.durationSeconds-journey.baseline.durationSeconds);
 const single=await service.stop(journey.id,ids[0]);assert(result.route.durationSeconds>single.route.durationSeconds);
 const removed=await service.stops(journey.id,[ids[0],ids[2]]);assert(removed.route.durationSeconds<result.route.durationSeconds);assert(!removed.route.path.some(p=>p.lat===demoPlaces[1].point.lat&&p.lng===demoPlaces[1].point.lng));
 if(mode==='TRAIN'||mode==='BUS')assert.equal(result.route.segments?.filter(s=>s.travelMode==='TRANSIT').length,4);
 await service.search(journey.id,{...filters,category:'bakery'});assert.deepEqual(await service.stops(journey.id,ids),result);
 assert.deepEqual(await service.stops(journey.id,[]),{route:journey.baseline,extraSeconds:0});
 await assert.rejects(service.stops(journey.id,['missing']),/Search this journey/);await assert.rejects(service.stops(journey.id,[ids[0],ids[0]]),/unique/);
 }
});

test('multi-stop endpoint validates ordered unique stops and supports clearing them',async()=>{
 const server=createApp(new DemoProvider(),new MemoryInteractionStore(),{mode:'demo'}).listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('No address');
 const post=(path:string,body:unknown)=>fetch(`http://127.0.0.1:${address.port}/api`+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 try{const journey=await (await post('/routes',input)).json();await post('/restaurants/search',{journeyId:journey.id,filters});
 const body={journeyId:journey.id,placeIds:['demo-1','demo-2']};const response=await post('/routes/with-stops',body);assert.equal(response.status,200);const multi=await response.json();assert(multi.extraSeconds>0);
 assert.equal((await post('/routes/with-stops',{...body,placeIds:['demo-1','demo-1']})).status,400);assert.equal((await post('/routes/with-stops',{...body,placeIds:Array.from({length:10},(_,i)=>String(i))})).status,400);assert.equal((await post('/routes/with-stops',{...body,placeIds:['missing']})).status,404);
 const cleared=await (await post('/routes/with-stops',{...body,placeIds:[]})).json();assert.deepEqual(cleared,{route:journey.baseline,extraSeconds:0});
 }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});

test('food-stop routes keep the baseline endpoints instead of geocoding ambiguous names again',async()=>{
 const provider=new DemoProvider();const route=provider.route.bind(provider);let direct=true;
 provider.route=async(input,stop,additional)=>{if(!direct){assert.deepEqual(input.origin.point,{lat:42.3505,lng:-71.1054});assert.deepEqual(input.destination.point,{lat:42.355,lng:-71.0656});}return route(input,stop,additional);};
 const service=new JourneyService(provider,new MemoryInteractionStore());const journey=await service.create(input);direct=false;await service.search(journey.id,filters);
 for(const ids of [['demo-4'],['demo-3'],['demo-6'],['demo-4','demo-3','demo-6']]){const result=await service.stops(journey.id,ids);assert.deepEqual(result.route.path[0],journey.baseline.path[0]);assert.deepEqual(result.route.path.at(-1),journey.baseline.path.at(-1));}
});
