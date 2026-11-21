import type {RouteSegment,TransitStop} from './schema.js';
export const walkingColor='#5965a6';
export const routeBlue='#4285f4';
export function segmentColor(segment:RouteSegment){
 if(segment.travelMode==='WALK')return walkingColor;
 if(segment.travelMode!=='TRANSIT')return routeBlue;
 if(segment.color&&/^#?[0-9a-f]{6}$/i.test(segment.color))return '#'+segment.color.replace(/^#/,'');
 const name=segment.lineName??'';
 return /green/i.test(name)?'#00843d':/red/i.test(name)?'#da291c':/orange/i.test(name)?'#ed8b00':/blue/i.test(name)?'#003da5':/silver/i.test(name)?'#7c878e':/purple|commuter/i.test(name)?'#80276c':routeBlue;
}
export const transitVehicle=(segment:RouteSegment)=>segment.vehicleType==='BUS'||segment.vehicleType==='TROLLEYBUS'?'Bus':'Train';
export function transitMarkers(segments:RouteSegment[]){
 const markers=new Map<string,TransitStop&{color:string;actions:string[];lines:string[]}>();
 for(const segment of segments){if(segment.travelMode!=='TRANSIT')continue;
 for(const [stop,action] of [[segment.departureStop,'Board'],[segment.arrivalStop,'Get off']] as const){
 if(!stop)continue;const key=`${stop.name.toLowerCase()}:${stop.point.lat.toFixed(4)},${stop.point.lng.toFixed(4)}`;const line=segment.lineName??transitVehicle(segment);const existing=markers.get(key);
 if(existing){if(!existing.actions.includes(action))existing.actions.push(action);if(!existing.lines.includes(line))existing.lines.push(line);}
 else markers.set(key,{...stop,color:segmentColor(segment),actions:[action],lines:[line]});
 }}
 return [...markers.values()].map(marker=>({...marker,label:`${marker.actions.length>1?'Transfer':marker.actions[0]}: ${marker.name}`,description:marker.lines.join(' · ')}));
}

// Combine turn-by-turn walking steps for legible labels, keeping food-stop boundaries.
export function routeSteps(segments:RouteSegment[]){
 const steps:RouteSegment[]=[];
 for(const segment of segments){const previous=steps.at(-1);
 if(segment.travelMode==='WALK'&&previous?.travelMode==='WALK'&&!segment.startLabel&&!previous.endLabel){
 previous.path=[...previous.path,...segment.path];previous.endLabel=segment.endLabel;
 previous.durationSeconds=previous.durationSeconds!==undefined&&segment.durationSeconds!==undefined?previous.durationSeconds+segment.durationSeconds:undefined;
 previous.distanceMeters=previous.distanceMeters!==undefined&&segment.distanceMeters!==undefined?previous.distanceMeters+segment.distanceMeters:undefined;
 }else steps.push({...segment,path:[...segment.path]});
 }
 return steps;
}
export function walkingMarkers(segments:RouteSegment[]){return routeSteps(segments).filter(s=>s.travelMode==='WALK'&&s.path.length>1).map(segment=>({point:segment.path[Math.floor(segment.path.length/2)],label:segment.durationSeconds!==undefined?`Walk ${Math.max(1,Math.ceil(segment.durationSeconds/60))} min`:'Walk',description:[segment.startLabel&&`From ${segment.startLabel}`,segment.endLabel&&`to ${segment.endLabel}`].filter(Boolean).join(' ')}));}
